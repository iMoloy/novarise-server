const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

// 1. Process payment (mock purchase)
router.post("/checkout", authenticateToken, requireRole(["supporter"]), async (req, res) => {
  try {
    const { credits, price } = req.body;

    if (!credits || !price) {
      return res.status(400).json({ error: "Credits and price details are required." });
    }

    const { db } = await connectToDatabase();

    const paymentRecord = {
      supporter_email: req.user.email.toLowerCase(),
      credits_purchased: Number(credits),
      amount_paid: Number(price),
      payment_date: new Date(),
      status: "success",
    };
    await db.collection("payments").insertOne(paymentRecord);

    // Increase Supporter's available credits
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $inc: { credits: Number(credits) } }
    );

    // Notify Supporter
    await db.collection("notifications").insertOne({
      message: `You successfully purchased ${credits} credits for $${price}!`,
      toEmail: req.user.email.toLowerCase(),
      actionRoute: "/dashboard",
      time: new Date(),
      read: false,
    });

    return res.status(200).json({
      message: `Successfully purchased ${credits} credits!`,
      credits: Number(credits),
    });

  } catch (error) {
    console.error("POST checkout server error:", error);
    return res.status(500).json({ error: "Failed to process payment." });
  }
});

// 2. Fetch payment transaction history (Admin see all, supporter see their own)
router.get("/checkout", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    let query = {};

    if (req.user.role === "supporter") {
      query.supporter_email = req.user.email.toLowerCase();
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin or Supporter role required." });
    }

    const payments = await db
      .collection("payments")
      .find(query)
      .sort({ payment_date: -1 })
      .toArray();

    const serialized = payments.map((p) => ({
      id: p._id.toString(),
      supporter_email: p.supporter_email,
      credits_purchased: p.credits_purchased,
      amount_paid: p.amount_paid,
      payment_date: p.payment_date.toISOString(),
      status: p.status,
    }));

    return res.status(200).json({ payments: serialized });

  } catch (error) {
    console.error("GET checkout history server error:", error);
    return res.status(500).json({ error: "Failed to fetch payment logs." });
  }
});

module.exports = router;
