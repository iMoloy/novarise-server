const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/novarise";
const MONGODB_DB = process.env.MONGODB_DB || "novarise";

let client = null;
let db = null;

async function connectToDatabase() {
  if (db) return { client, db };

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  console.log("Connected to MongoDB successfully.");
  return { client, db };
}

module.exports = { connectToDatabase };
