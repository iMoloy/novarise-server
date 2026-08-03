const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");
const { validateBody, withdrawalCreateSchema } = require("../middlewares/validate");
const { sendEmail, withdrawalApprovedEmail } = require("../utils/email");

const router = express.Router();

function idFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: new ObjectId() };
}

// 1. Fetch withdrawals
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    let query = {};

    if (req.user.role === "creator") {
      query.creator_email = req.user.email.toLowerCase();
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin or Creator role required." });
    }

    const withdrawals = await db
      .collection("withdrawals")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = withdrawals.map((w) => ({
      id: w._id.toString(),
      creator_name: w.creator_name,
      creator_email: w.creator_email,
      withdrawal_credit: w.withdrawal_credit,
      withdrawal_amount: w.withdrawal_amount,
      payment_system: w.payment_system,
      account_number: w.account_number,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    }));

    return res.status(200).json({ withdrawals: serialized });

  } catch (error) {
    console.error("GET withdrawals server error:", error);
    return res.status(500).json({ error: "Failed to load withdrawals." });
  }
});

// 2. Request withdrawal (Creator only)
router.post("/", authenticateToken, requireRole(["creator"]), validateBody(withdrawalCreateSchema), async (req, res) => {
  try {
    const { credits_to_withdraw, payment_system, account_number } = req.body;

    if (!credits_to_withdraw || !payment_system || !account_number || Number(credits_to_withdraw) <= 0) {
      return res.status(400).json({ error: "Invalid parameters." });
    }

    const credits = Number(credits_to_withdraw);
    const dollarAmount = credits / 20;

    if (credits < 200) {
      return res.status(400).json({ error: "Minimum withdrawal amount is 200 credits ($10)." });
    }

    const { db } = await connectToDatabase();

    const creator = await db.collection("users").findOne({ _id: new ObjectId(req.user.userId) });
    if (!creator) {
      return res.status(404).json({ error: "Creator account not found." });
    }

    // Verify balance against pending requests
    const pendingWithdrawals = await db
      .collection("withdrawals")
      .find({ creator_email: req.user.email.toLowerCase(), status: "pending" })
      .toArray();

    const totalPending = pendingWithdrawals.reduce((sum, w) => sum + w.withdrawal_credit, 0);
    const available = creator.credits - totalPending;

    if (credits > available) {
      return res.status(400).json({ error: "Insufficient available credits." });
    }

    const newWithdrawal = {
      creator_name: req.user.name,
      creator_email: req.user.email.toLowerCase(),
      withdrawal_credit: credits,
      withdrawal_amount: dollarAmount,
      payment_system,
      account_number,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await db.collection("withdrawals").insertOne(newWithdrawal);

    // Notify Admin
    const admins = await db.collection("users").find({ role: "admin" }).toArray();
    const notifications = admins.map((admin) => ({
      message: `Withdrawal request of $${dollarAmount} by ${req.user.name} is pending payout.`,
      toEmail: admin.email,
      actionRoute: "/dashboard",
      time: new Date(),
      read: false,
    }));
    if (notifications.length > 0) {
      await db.collection("notifications").insertMany(notifications);
    }

    return res.status(201).json({
      message: "Withdrawal request submitted successfully.",
      withdrawalId: result.insertedId.toString(),
    });

  } catch (error) {
    console.error("POST withdrawal server error:", error);
    return res.status(500).json({ error: "Failed to submit request." });
  }
});

// 3. Payout success approval (Admin only)
router.put("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    if (!withdrawalId) {
      return res.status(400).json({ error: "Withdrawal ID is required." });
    }

    const { db } = await connectToDatabase();
    const withdrawal = await db.collection("withdrawals").findOne(idFilter(withdrawalId));

    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal request not found." });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({ error: "Withdrawal has already been paid." });
    }

    // 1. Approve withdrawal status
    await db.collection("withdrawals").updateOne(
      idFilter(withdrawalId),
      { $set: { status: "approved" } }
    );

    // 2. Deduct credits from Creator user document
    await db.collection("users").updateOne(
      { email: withdrawal.creator_email },
      { $inc: { credits: -withdrawal.withdrawal_credit } }
    );

    // Notify Creator
    await db.collection("notifications").insertOne({
      message: `Your withdrawal request of $${withdrawal.withdrawal_amount} (${withdrawal.withdrawal_credit} credits) was processed successfully.`,
      toEmail: withdrawal.creator_email,
      actionRoute: "/dashboard",
      time: new Date(),
      read: false,
    });

    // Send Email to Creator
    const creatorUser = await db.collection("users").findOne({ email: withdrawal.creator_email });
    if (creatorUser) {
      sendEmail(
        withdrawal.creator_email,
        `Your withdrawal of $${withdrawal.withdrawal_amount} has been approved!`,
        withdrawalApprovedEmail(creatorUser.name, withdrawal.withdrawal_credit, withdrawal.withdrawal_amount)
      );
    }

    return res.status(200).json({ message: "Payout approved and creator credits debited." });

  } catch (error) {
    console.error("PUT withdrawal server error:", error);
    return res.status(500).json({ error: "Failed to process withdrawal." });
  }
});

module.exports = router;
