const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");
const { validateBody, campaignCreateSchema } = require("../middlewares/validate");
const { sendEmail, campaignStatusEmail, newContributionEmail } = require("../utils/email");

const router = express.Router();

// Helper filter ID
function idFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: new ObjectId() };
}

// 1. Fetch campaigns (supports status and creatorEmail filters)
router.get("/", async (req, res) => {
  try {
    const { creatorEmail, status } = req.query;
    const { db } = await connectToDatabase();
    const query = {};

    if (creatorEmail) {
      query.creator_email = creatorEmail.toLowerCase();
    } else if (status) {
      if (status !== "all") {
        query.status = status;
      }
    } else {
      query.status = "approved"; // default
    }

    const campaigns = await db
      .collection("campaigns")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = campaigns.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      story: c.story,
      category: c.category,
      funding_goal: c.funding_goal,
      minimum_contribution: c.minimum_contribution,
      deadline: c.deadline,
      reward_info: c.reward_info,
      image_url: c.image_url,
      status: c.status,
      amount_raised: c.amount_raised,
      creator_name: c.creator_name,
      creator_email: c.creator_email,
      createdAt: c.createdAt.toISOString(),
    }));

    return res.status(200).json({ campaigns: serialized });

  } catch (error) {
    console.error("GET campaigns server error:", error);
    return res.status(550).json({ error: "Failed to load campaigns." });
  }
});

// 2. Fetch single campaign details
router.get("/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const campaign = await db.collection("campaigns").findOne(idFilter(req.params.id));

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const milestones = campaign.milestones || [
      { id: "m1", title: "Prototype Development & Verification", percentage: 40, status: "completed" },
      { id: "m2", title: "Production & Component Sourcing", percentage: 40, status: "in_progress" },
      { id: "m3", title: "Final Distribution & Backer Shipping", percentage: 20, status: "pending" },
    ];

    return res.status(200).json({
      campaign: {
        id: campaign._id.toString(),
        title: campaign.title,
        story: campaign.story,
        category: campaign.category,
        funding_goal: campaign.funding_goal,
        minimum_contribution: campaign.minimum_contribution,
        deadline: campaign.deadline,
        reward_info: campaign.reward_info,
        image_url: campaign.image_url,
        status: campaign.status,
        amount_raised: campaign.amount_raised,
        creator_name: campaign.creator_name,
        creator_email: campaign.creator_email,
        milestones: milestones,
        createdAt: campaign.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error("GET campaign by ID server error:", error);
    return res.status(500).json({ error: "Failed to fetch campaign details." });
  }
});

// 3. Launch Campaign (Creator only)
router.post("/", authenticateToken, requireRole(["creator"]), validateBody(campaignCreateSchema), async (req, res) => {
  try {
    const {
      title,
      story,
      category,
      funding_goal,
      minimum_contribution,
      deadline,
      reward_info,
      image_url,
    } = req.body;

    if (
      !title ||
      !story ||
      !category ||
      !funding_goal ||
      !minimum_contribution ||
      !deadline ||
      !reward_info ||
      !image_url
    ) {
      return res.status(400).json({ error: "All campaign fields are required." });
    }

    const { db } = await connectToDatabase();

    const newCampaign = {
      title,
      story,
      category,
      funding_goal: Number(funding_goal),
      minimum_contribution: Number(minimum_contribution),
      deadline,
      reward_info,
      image_url,
      status: "pending",
      amount_raised: 0,
      creator_name: req.user.name,
      creator_email: req.user.email.toLowerCase(),
      createdAt: new Date(),
    };

    const result = await db.collection("campaigns").insertOne(newCampaign);

    // Notify Admins
    const admins = await db.collection("users").find({ role: "admin" }).toArray();
    const notifications = admins.map((admin) => ({
      message: `New campaign "${title}" submitted by ${req.user.name} is pending review.`,
      toEmail: admin.email,
      actionRoute: "/dashboard",
      time: new Date(),
      read: false,
    }));
    if (notifications.length > 0) {
      await db.collection("notifications").insertMany(notifications);
    }

    return res.status(201).json({
      message: "Campaign submitted successfully. Pending admin approval.",
      campaignId: result.insertedId.toString(),
    });

  } catch (error) {
    console.error("POST campaign server error:", error);
    return res.status(500).json({ error: "Failed to launch campaign." });
  }
});

// 4. Update Campaign (Creator updates details, OR Admin reviews status)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const campaign = await db.collection("campaigns").findOne(idFilter(req.params.id));

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    if (req.user.role === "admin") {
      // Admin update status
      const { status } = req.body;
      if (!status || (status !== "approved" && status !== "rejected")) {
        return res.status(400).json({ error: "Invalid status value." });
      }

      await db.collection("campaigns").updateOne(
        idFilter(req.params.id),
        { $set: { status } }
      );

      // Create Notification
      const message = status === "approved"
        ? `Your campaign "${campaign.title}" was approved by Admin.`
        : `Your campaign "${campaign.title}" was rejected by Admin.`;

      await db.collection("notifications").insertOne({
        message,
        toEmail: campaign.creator_email,
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      });

      // Send Email Notification to Creator
      const creatorUser = await db.collection("users").findOne({ email: campaign.creator_email });
      if (creatorUser) {
        sendEmail(
          campaign.creator_email,
          `Your Campaign "${campaign.title}" has been ${status}`,
          campaignStatusEmail(creatorUser.name, campaign.title, status)
        );
      }

      return res.status(200).json({ message: `Campaign status updated to ${status}.` });

    } else if (req.user.role === "creator") {
      // Creator update fields
      if (campaign.creator_email !== req.user.email.toLowerCase()) {
        return res.status(403).json({ error: "Forbidden. You can only update your own campaigns." });
      }

      const { title, story, reward_info } = req.body;
      if (!title || !story || !reward_info) {
        return res.status(400).json({ error: "Title, story, and reward info are required." });
      }

      await db.collection("campaigns").updateOne(
        idFilter(req.params.id),
        { $set: { title, story, reward_info } }
      );

      return res.status(200).json({ message: "Campaign details updated successfully." });
    }

    return res.status(403).json({ error: "Forbidden role access." });

  } catch (error) {
    console.error("PUT campaign server error:", error);
    return res.status(500).json({ error: "Failed to update campaign details." });
  }
});

// 5. Delete Campaign & Refund Backers (Creator / Admin)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const campaign = await db.collection("campaigns").findOne(idFilter(req.params.id));

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const isCreator = req.user.role === "creator" && campaign.creator_email === req.user.email.toLowerCase();
    const isAdmin = req.user.role === "admin";
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: "Forbidden delete access." });
    }

    // Refund approved contributions
    const approvedContributions = await db
      .collection("contributions")
      .find({ campaign_id: req.params.id, status: "approved" })
      .toArray();

    for (const contribution of approvedContributions) {
      await db.collection("users").updateOne(
        { email: contribution.supporter_email },
        { $inc: { credits: contribution.contribution_amount } }
      );

      // Notify supporters
      await db.collection("notifications").insertOne({
        message: `Your contribution of ${contribution.contribution_amount} credits for "${campaign.title}" was refunded because the campaign was deleted.`,
        toEmail: contribution.supporter_email,
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      });
    }

    // Set remaining contributions status to rejected/cancelled
    await db.collection("contributions").updateMany(
      { campaign_id: req.params.id },
      { $set: { status: "rejected" } }
    );

    // Delete Campaign from collection
    await db.collection("campaigns").deleteOne(idFilter(req.params.id));

    return res.status(200).json({ message: "Campaign deleted and approved backers refunded." });

  } catch (error) {
    console.error("DELETE campaign server error:", error);
    return res.status(500).json({ error: "Failed to delete campaign." });
  }
});

// Update Campaign Milestone status (Creator / Admin)
router.post("/:id/milestones", authenticateToken, async (req, res) => {
  try {
    const { milestoneId, status } = req.body;
    if (!milestoneId || !status) {
      return res.status(400).json({ error: "milestoneId and status are required." });
    }

    const { db } = await connectToDatabase();
    const campaign = await db.collection("campaigns").findOne(idFilter(req.params.id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const currentMilestones = campaign.milestones || [
      { id: "m1", title: "Prototype Development & Verification", percentage: 40, status: "completed" },
      { id: "m2", title: "Production & Component Sourcing", percentage: 40, status: "in_progress" },
      { id: "m3", title: "Final Distribution & Backer Shipping", percentage: 20, status: "pending" },
    ];

    const updatedMilestones = currentMilestones.map((m) =>
      m.id === milestoneId ? { ...m, status: status } : m
    );

    await db.collection("campaigns").updateOne(
      idFilter(req.params.id),
      { $set: { milestones: updatedMilestones } }
    );

    return res.json({ success: true, milestones: updatedMilestones });
  } catch (error) {
    console.error("POST milestones error:", error);
    return res.status(500).json({ error: "Failed to update milestone status." });
  }
});

module.exports = router;
