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

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Next.js Client
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3003"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

// Establish Database Connection and Start Listening
async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`NovaRise Server is listening on Port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failure. Server stopped.", error);
    process.exit(1);
  }
}

startServer();
