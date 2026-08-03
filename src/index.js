require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectToDatabase } = require("./config/db");

// Routers
const authRouter = require("./routes/auth");
const campaignsRouter = require("./routes/campaigns");
const contributionsRouter = require("./routes/contributions");
const withdrawalsRouter = require("./routes/withdrawals");
const usersRouter = require("./routes/users");
const reportsRouter = require("./routes/reports");
const notificationsRouter = require("./routes/notifications");
const paymentsRouter = require("./routes/payments");
const aiRouter = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Next.js Client
app.use(
  cors({
    origin: "*", // Allows any origin, including Vercel deployments
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Routes Mount
app.use("/api/auth", authRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/contributions", contributionsRouter);
app.use("/api/withdrawals", withdrawalsRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/payment", paymentsRouter);
app.use("/api/ai", aiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

// For Vercel, connect to DB on cold start
connectToDatabase().catch(console.dir);

// Start Server Locally if not in Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`NovaRise Server is listening on Port ${PORT}`);
  });
}

// Export for Vercel Serverless
module.exports = app;
