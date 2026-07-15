const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

function idFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: new ObjectId() };
}

// 1. Get users list (Admin only)
router.get("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const users = await db
      .collection("users")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      photo_url: u.photo_url || "",
      credits: u.credits,
      createdAt: u.createdAt.toISOString(),
    }));

    return res.status(200).json({ users: serialized });

  } catch (error) {
    console.error("GET users server error:", error);
    return res.status(500).json({ error: "Failed to load users." });
  }
});

// 2. Change user role (Admin only)
router.put("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role || (role !== "admin" && role !== "creator" && role !== "supporter")) {
      return res.status(400).json({ error: "Invalid parameters." });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection("users").updateOne(
      idFilter(userId),
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({ message: "User role updated successfully." });

  } catch (error) {
    console.error("PUT user server error:", error);
    return res.status(550).json({ error: "Failed to update role." });
  }
});

// 3. Remove user (Admin only)
router.delete("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const { db } = await connectToDatabase();
    const result = await db.collection("users").deleteOne(idFilter(userId));

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.status(200).json({ message: "User deleted from server database." });

  } catch (error) {
    console.error("DELETE user server error:", error);
    return res.status(550).json({ error: "Failed to delete user." });
  }
});

module.exports = router;
