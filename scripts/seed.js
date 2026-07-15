const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/novarise";
const MONGODB_DB = process.env.MONGODB_DB || "novarise";

async function main() {
  console.log("Seeding database...");
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    // Clear existing collections
    await db.collection("users").deleteMany({});
    await db.collection("campaigns").deleteMany({});
    await db.collection("contributions").deleteMany({});
    await db.collection("withdrawals").deleteMany({});
    await db.collection("reports").deleteMany({});
    await db.collection("notifications").deleteMany({});
    await db.collection("payments").deleteMany({});

    console.log("Cleared existing collections.");

    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash("AdminPass123!", salt);
    const creatorPass = await bcrypt.hash("CreatorPass123!", salt);
    const supporterPass = await bcrypt.hash("SupporterPass123!", salt);

    // 1. Seed Users
    const users = [
      {
        name: "NovaRise Admin",
        email: "admin@novarise.com",
        passwordHash: adminPass,
        role: "admin",
        photo_url: "https://images.unsplash.com/photo-1541462608141-2ff586485028?w=150&auto=format&fit=crop&q=80",
        credits: 1000,
        createdAt: new Date(),
      },
      {
        name: "Sarah Jenkins",
        email: "creator@novarise.com",
        passwordHash: creatorPass,
        role: "creator",
        photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        credits: 220, // default 20 + 200 approved contribution credits
        createdAt: new Date(),
      },
      {
        name: "David Miller",
        email: "supporter@novarise.com",
        passwordHash: supporterPass,
        role: "supporter",
        photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        credits: 450, // default 50 + bought credits
        createdAt: new Date(),
      },
    ];

    const userResults = await db.collection("users").insertMany(users);
    console.log(`Seeded ${userResults.insertedCount} users.`);

    // 2. Seed Campaigns
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureIso = futureDate.toISOString().split("T")[0];

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const pastIso = pastDate.toISOString().split("T")[0];

    const campaigns = [
      {
        title: "Clean Water Solar Grid - Africa",
        story: "Providing clean drinking water to remote villages using solar-powered purification grids. Each unit filters 5,000 liters daily and runs completely off-grid. The project covers parts of Kenya and Uganda, bringing accessible infrastructure to communities facing extreme drought.",
        category: "Community",
        funding_goal: 3000,
        minimum_contribution: 25,
        deadline: futureIso,
        reward_info: "Early updates, a PDF project report with photos of the installed solar units, and village thank-you letters.",
        image_url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80",
        status: "approved",
        amount_raised: 1200,
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        createdAt: new Date(),
      },
      {
        title: "VR Learn: Interactive Astronomy Platform",
        story: "An educational VR platform allowing school children to interactively touch galaxies, walk on mars, and visualize orbital mechanics. Our goal is to bring immersive STEM materials into classrooms around the globe at affordable price points.",
        category: "Technology",
        funding_goal: 5000,
        minimum_contribution: 50,
        deadline: futureIso,
        reward_info: "Lifetime beta access license to the VR software and your name featured in the product end credits.",
        image_url: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&auto=format&fit=crop&q=80",
        status: "approved",
        amount_raised: 2800,
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        createdAt: new Date(),
      },
      {
        title: "Carbon-Negative Structural Concrete",
        story: "Developing bio-char concrete panels for housing builds that trap greenhouse gases instead of releasing them. A breakthrough for building sustainable zero-emission cities of the near future.",
        category: "Art & Design",
        funding_goal: 2000,
        minimum_contribution: 15,
        deadline: futureIso,
        reward_info: "3D structural blueprints for housing panels and a miniature physical sample of carbon-negative block material.",
        image_url: "https://images.unsplash.com/photo-1618005198143-e5283b519a7f?w=600&auto=format&fit=crop&q=80",
        status: "pending",
        amount_raised: 0,
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        createdAt: new Date(),
      },
      {
        title: "Eco Friendly Bio-Degradable Tech Case",
        story: "Organic flaxseed tech cases that decompose in active compost within 12 weeks of discard, protecting both your premium laptops and the environment.",
        category: "Technology",
        funding_goal: 1000,
        minimum_contribution: 10,
        deadline: pastIso, // Expired Campaign
        reward_info: "Early pre-order cases with custom colors.",
        image_url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
        status: "approved",
        amount_raised: 400,
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        createdAt: new Date(),
      },
    ];

    const campaignResults = await db.collection("campaigns").insertMany(campaigns);
    console.log(`Seeded ${campaignResults.insertedCount} campaigns.`);

    const seededCampaigns = await db.collection("campaigns").find().toArray();
    const waterGridCamp = seededCampaigns.find((c) => c.title.includes("Clean Water"));
    const vrLearnCamp = seededCampaigns.find((c) => c.title.includes("VR Learn"));

    // 3. Seed Contributions
    const contributions = [
      {
        campaign_id: waterGridCamp?._id.toString(),
        campaign_title: waterGridCamp?.title,
        contribution_amount: 200,
        supporter_name: "David Miller",
        supporter_email: "supporter@novarise.com",
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        status: "approved",
        createdAt: new Date(),
      },
      {
        campaign_id: vrLearnCamp?._id.toString(),
        campaign_title: vrLearnCamp?.title,
        contribution_amount: 150,
        supporter_name: "David Miller",
        supporter_email: "supporter@novarise.com",
        creator_name: "Sarah Jenkins",
        creator_email: "creator@novarise.com",
        status: "pending",
        createdAt: new Date(),
      },
    ];

    const contributionResults = await db.collection("contributions").insertMany(contributions);
    console.log(`Seeded ${contributionResults.insertedCount} contributions.`);

    // 4. Seed Payments (Transactions history for buying credits)
    const payments = [
      {
        supporter_email: "supporter@novarise.com",
        credits_purchased: 500,
        amount_paid: 45,
        payment_date: new Date(),
        status: "success",
      },
    ];
    await db.collection("payments").insertMany(payments);
    console.log("Seeded credit transaction history.");

    // 5. Seed Notifications
    const notifications = [
      {
        message: "Welcome to NovaRise! Create or explore premium campaigns.",
        toEmail: "creator@novarise.com",
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      },
      {
        message: "Welcome to NovaRise! Create or explore premium campaigns.",
        toEmail: "supporter@novarise.com",
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      },
      {
        message: 'Your Contribution of 200 credits to "Clean Water Solar Grid - Africa" was approved by Sarah Jenkins.',
        toEmail: "supporter@novarise.com",
        actionRoute: "/dashboard",
        time: new Date(),
        read: false,
      },
    ];
    await db.collection("notifications").insertMany(notifications);
    console.log("Seeded notifications.");

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Failed to seed database:", error);
  } finally {
    await client.close();
  }
}

main();
