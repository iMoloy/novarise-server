const express = require("express");
const { connectToDatabase } = require("../config/db");
const { authenticateToken } = require("../middlewares/auth");

const router = express.Router();

// 1. Fetch user notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const notifications = await db
      .collection("notifications")
      .find({ toEmail: req.user.email.toLowerCase() })
      .sort({ time: -1 })
      .toArray();

    const serialized = notifications.map((n) => ({
      id: n._id.toString(),
      message: n.message,
      toEmail: n.toEmail,
      actionRoute: n.actionRoute,
      time: n.time.toISOString(),
      read: n.read,
    }));

    return res.status(200).json({ notifications: serialized });

  } catch (error) {
    console.error("GET notifications server error:", error);
    return res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// 2. Mark all as read
router.put("/", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    await db.collection("notifications").updateMany(
      { toEmail: req.user.email.toLowerCase(), read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({ message: "Notifications marked as read." });

  } catch (error) {
    console.error("PUT notifications server error:", error);
    return res.status(500).json({ error: "Failed to update notifications." });
  }
});

module.exports = router;
