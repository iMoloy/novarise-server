# NovaRise - Server

API Live Base URL: https://novarise-server.vercel.app

This is the backend server API for **NovaRise**, a futuristic crowdfunding platform. It uses Express.js and MongoDB to provide role-based actions, authentication, real-time database management, notifications, and automated email processing.

## Features

- **JWT Authentication & Authorization**: Custom middleware verifying roles (`Admin`, `Creator`, `Supporter`) on request handlers.
- **Google OAuth Sync**: Endpoint for automatic synchronization/registration of Google-authenticated users.
- **Automated HTML Email Notifications**: Uses `nodemailer` to dispatch branded email alerts on campaign approvals, new contributions, contribution updates, and withdrawal success.
- **MongoDB Aggregation/Queries**: Handles collection relations, statistics calculations, and status actions safely.
- **Database Pre-population**: Seeding script to initialize essential collections with demo data.

## Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB Native Driver**
- **JSON Web Token (JWT)**
- **Nodemailer**
- **Cors & dotenv**

## Project Structure

```
src/
├── config/           # Database Connection Setup
├── middlewares/      # Token Verification and Role Access Control
├── routes/           # API Endpoint Handlers
│   ├── auth.js          # User Login/Signup & Google Auth
│   ├── campaigns.js     # Campaign CRUD & Approvals
│   ├── contributions.js # Pledge & escrow flow
│   ├── withdrawals.js   # Withdrawal request & payouts
│   └── notifications.js # System notification triggers
├── utils/            # Email sender and templates
└── index.js          # App Server Entrypoint
```

## Environment Variables

Create `.env` inside `novarise-server` directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=novarise
JWT_SECRET=your_jwt_signing_secret

# ImgBB API Key
IMGBB_API_KEY=your_imgbb_api_key

# SMTP Email Config (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
```

## Local Development

```bash
npm install
npm run dev
```

The server runs on `http://localhost:5000`.
