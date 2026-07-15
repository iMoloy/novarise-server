const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");
const { sendEmail, contributionStatusEmail, newContributionEmail } = require("../utils/email");

const router = express.Router();

function idFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: new ObjectId() };
}

// 1. Fetch contributions list (with pagination)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "5");
    const status = req.query.status;

    const { db } = await connectToDatabase();
    const query = {};

    if (req.user.role === "supporter") {
      query.supporter_email = req.user.email.toLowerCase();
    } else if (req.user.role === "creator") {
      query.creator_email = req.user.email.toLowerCase();
    }

    if (status) {
      query.status = status;
    }

    const total = await db.collection("contributions").countDocuments(query);
    const skip = (page - 1) * limit;

    const contributions = await db
      .collection("contributions")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const serialized = contributions.map((c) => ({
      id: c._id.toString(),
      campaign_id: c.campaign_id,
      campaign_title: c.campaign_title,
      contribution_amount: c.contribution_amount,
      supporter_name: c.supporter_name,
      supporter_email: c.supporter_email,
      creator_name: c.creator_name,
      creator_email: c.creator_email,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    }));

    return res.status(200).json({
      contributions: serialized,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("GET contributions server error:", error);
    return res.status(500).json({ error: "Failed to load contributions." });
  }
});

// 2. Back a campaign (submit pledge)
router.post("/", authenticateToken, requireRole(["supporter"]), async (req, res) => {
  try {
    const { campaign_id, contribution_amount } = req.body;

    if (!campaign_id || !contribution_amount || Number(contribution_amount) <= 0) {
      return res.status(400).json({ error: "Invalid campaign ID or amount." });
    }

    const amount = Number(contribution_amount);
    const { db } = await connectToDatabase();

    const campaign = await db.collection("campaigns").findOne(idFilter(campaign_id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    if (campaign.status !== "approved") {
      return res.status(400).json({ error: "This campaign is not active." });
    }

    if (new Date(campaign.deadline) < new Date()) {
      return res.status(400).json({ error: "This campaign has reached its deadline." });
    }

    if (amount < campaign.minimum_contribution) {
      return res.status(400).json({
        error: `Minimum contribution is ${campaign.minimum_contribution} credits.`,
      });
    }

    // Verify balance
    const supporter = await db.collection("users").findOne({ _id: new ObjectId(req.user.userId) });
    if (!supporter || supporter.credits < amount) {
      return res.status(400).json({ error: "Insufficient available credits." });
    }

    // Deduct credits immediately (held in escrow)
    await db.collection("users").updateOne(
      { _id: supporter._id },
      { $inc: { credits: -amount } }
    );

    // Save contribution record
    const newContribution = {
      campaign_id,
      campaign_title: campaign.title,
      contribution_amount: amount,
      supporter_name: req.user.name,
      supporter_email: req.user.email.toLowerCase(),
      creator_name: campaign.creator_name,
      creator_email: campaign.creator_email,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await db.collection("contributions").insertOne(newContribution);

    // Notify creator
    await db.collection("notifications").insertOne({
      message: `You received a Contribution of ${amount} credits to "${campaign.title}" from ${req.user.name}.`,
      toEmail: campaign.creator_email,
      actionRoute: "/dashboard",
      time: new Date(),
      read: false,
    });

    // Send Email to Creator
    sendEmail(
      campaign.creator_email,
      `New Contribution to "${campaign.title}"`,
      newContributionEmail(campaign.creator_name, req.user.name, campaign.title, amount)
    );

    return res.status(201).json({
      message: "Contribution submitted successfully. Awaiting creator review.",
      contributionId: result.insertedId.toString(),
    });

  } catch (error) {
    console.error("POST contribution server error:", error);
    return res.status(500).json({ error: "Failed to submit contribution." });
  }
});

// 3. Approve or Reject contribution (Creator only)
router.put("/", authenticateToken, requireRole(["creator"]), async (req, res) => {
  try {
    const { contributionId, action } = req.body;

    if (!contributionId || !action || (action !== "approve" && action !== "reject")) {
      return res.status(400).json({ error: "Invalid parameters." });
    }

    const { db } = await connectToDatabase();
    const contribution = await db.collection("contributions").findOne(idFilter(contributionId));

    if (!contribution) {
      return res.status(404).json({ error: "Contribution not found." });
    }

    if (contribution.creator_email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden review access." });
    }

    if (contribution.status !== "pending") {
      return res.status(400).json({ error: "Contribution has already been reviewed." });
    }

    if (action === "approve") {
      // Approve contribution
      await db.collection("contributions").updateOne(
        idFilter(contributionId),
        { $set: { status: "approved" } }
      );

      // Increase campaign raised amount
      await db.collection("campaigns").updateOne(
        idFilter(contribution.campaign_id),
        { $inc: { amount_raised: contribution.contribution_amount } }
      );

      // Add credits to creator balance
      await db.collection("users").updateOne(
        { email: contribution.creator_email },
        { $inc: { credits: contribution.contribution_amount } }
      );

      // Notify backer
      await db.collection("notifications").insertOne({
        message: `Your Contribution of ${contribution.contribution_amount} credits to "${contribution.campaign_title}" was approved by ${req.user.name}.`,
        toEmail: contribution.supporter_email,
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      });

      // Send Email to Supporter
      sendEmail(
        contribution.supporter_email,
        `Your contribution to "${contribution.campaign_title}" was approved!`,
        contributionStatusEmail(contribution.supporter_name, contribution.campaign_title, contribution.contribution_amount, "approved", req.user.name)
      );

      return res.status(200).json({ message: "Contribution approved and campaign raised credits updated." });

    } else {
      // Reject contribution
      await db.collection("contributions").updateOne(
        idFilter(contributionId),
        { $set: { status: "rejected" } }
      );

      // Refund credits to supporter balance
      await db.collection("users").updateOne(
        { email: contribution.supporter_email },
        { $inc: { credits: contribution.contribution_amount } }
      );

      // Notify backer
      await db.collection("notifications").insertOne({
        message: `Your Contribution of ${contribution.contribution_amount} credits to "${contribution.campaign_title}" was rejected by ${req.user.name}. Credits refunded.`,
        toEmail: contribution.supporter_email,
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      });

      // Send Email to Supporter
      sendEmail(
        contribution.supporter_email,
        `Your contribution to "${contribution.campaign_title}" was rejected`,
        contributionStatusEmail(contribution.supporter_name, contribution.campaign_title, contribution.contribution_amount, "rejected", req.user.name)
      );

      return res.status(200).json({ message: "Contribution rejected and supporter refunded." });
    }

  } catch (error) {
    console.error("PUT contribution server error:", error);
    return res.status(500).json({ error: "Failed to process contribution review." });
  }
});

module.exports = router;
