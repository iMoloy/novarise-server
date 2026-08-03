const express = require("express");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken, requireRole } = require("../middlewares/auth");

const router = express.Router();

function idFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: new ObjectId() };
}

// 1. Get reports list (Admin only)
router.get("/", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const reports = await db
      .collection("reports")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = reports.map((r) => ({
      id: r._id.toString(),
      campaign_id: r.campaign_id,
      campaign_title: r.campaign_title,
      reporter_name: r.reporter_name,
      reporter_email: r.reporter_email,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));

    return res.status(200).json({ reports: serialized });

  } catch (error) {
    console.error("GET reports server error:", error);
    return res.status(500).json({ error: "Failed to load reports." });
  }
});

// 2. Report a campaign (Supporter only)
router.post("/", authenticateToken, requireRole(["supporter"]), async (req, res) => {
  try {
    const { campaign_id, reason } = req.body;

    if (!campaign_id || !reason) {
      return res.status(400).json({ error: "Campaign ID and reason are required." });
    }

    const { db } = await connectToDatabase();

    const campaign = await db.collection("campaigns").findOne(idFilter(campaign_id));
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const newReport = {
      campaign_id,
      campaign_title: campaign.title,
      reporter_name: req.user.name,
      reporter_email: req.user.email.toLowerCase(),
      reason,
      createdAt: new Date(),
    };

    await db.collection("reports").insertOne(newReport);

    return res.status(201).json({ message: "Campaign reported successfully. Admin will review." });

  } catch (error) {
    console.error("POST report server error:", error);
    return res.status(500).json({ error: "Failed to report campaign." });
  }
});

// 3. Export CSV Data Report (Admin / Creator)
router.get("/export", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    let query = {};
    if (req.user.role === "creator") {
      query.creator_email = req.user.email.toLowerCase();
    }

    const campaigns = await db.collection("campaigns").find(query).toArray();
    let csvHeader = "ID,Title,Category,Funding Goal,Amount Raised,Status,Creator Email\n";
    let csvRows = campaigns
      .map(
        (c) =>
          `"${c._id}","${c.title.replace(/"/g, '""')}","${c.category}",${c.funding_goal},${c.amount_raised},"${c.status}","${c.creator_email}"`
      )
      .join("\n");

    const csvContent = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="novarise_campaigns_report.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("GET export CSV server error:", error);
    return res.status(500).json({ error: "Failed to export report CSV." });
  }
});

module.exports = router;
