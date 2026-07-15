const nodemailer = require("nodemailer");

// Transporter setup using Gmail SMTP (App Password required)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an HTML email notification.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 */
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] SMTP credentials not configured. Skipping email send.");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"NovaRise Platform" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}

// ─── Email Templates ────────────────────────────────────────────────────

function emailWrapper(content) {
  return `
    <div style="font-family: 'Segoe UI', sans-serif; background:#0c0f1a; color:#e2e8f0; padding:40px 20px; min-height:100vh;">
      <div style="max-width:560px; margin:0 auto; background:#12162a; border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4); padding:24px 32px;">
          <h1 style="margin:0; font-size:22px; color:#fff; letter-spacing:-0.5px;">⚡ NovaRise</h1>
          <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.7);">Futuristic Crowdfunding Launchpad</p>
        </div>
        <div style="padding:32px;">
          ${content}
        </div>
        <div style="padding:16px 32px; border-top:1px solid rgba(255,255,255,0.06); text-align:center;">
          <p style="margin:0; font-size:11px; color:#475569;">© 2025 NovaRise Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// 1. Campaign Approved/Rejected → Creator
function campaignStatusEmail(creatorName, campaignTitle, status) {
  const isApproved = status === "approved";
  const color = isApproved ? "#34d399" : "#f87171";
  const icon = isApproved ? "✅" : "❌";
  return emailWrapper(`
    <h2 style="margin:0 0 8px; font-size:18px; color:#fff;">${icon} Campaign ${isApproved ? "Approved" : "Rejected"}</h2>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">Hi <strong style="color:#e2e8f0;">${creatorName}</strong>,</p>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
      Your campaign <strong style="color:${color};">"${campaignTitle}"</strong> has been 
      <strong style="color:${color};">${status}</strong> by the NovaRise Admin team.
    </p>
    ${isApproved
      ? `<p style="color:#94a3b8; font-size:14px;">Your campaign is now live and visible to Supporters. Best of luck!</p>`
      : `<p style="color:#94a3b8; font-size:14px;">If you believe this was a mistake, please reach out to our support team.</p>`
    }
    <a href="https://novarise-client.vercel.app/dashboard" style="display:inline-block; margin-top:16px; padding:12px 24px; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:#fff; border-radius:10px; text-decoration:none; font-size:13px; font-weight:600;">View Dashboard</a>
  `);
}

// 2. Contribution Approved/Rejected → Supporter
function contributionStatusEmail(supporterName, campaignTitle, amount, status, creatorName) {
  const isApproved = status === "approved";
  const color = isApproved ? "#34d399" : "#f87171";
  const icon = isApproved ? "✅" : "❌";
  return emailWrapper(`
    <h2 style="margin:0 0 8px; font-size:18px; color:#fff;">${icon} Contribution ${isApproved ? "Approved" : "Rejected"}</h2>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">Hi <strong style="color:#e2e8f0;">${supporterName}</strong>,</p>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
      Your contribution of <strong style="color:#22d3ee;">${amount} Credits</strong> to 
      <strong style="color:${color};">"${campaignTitle}"</strong> has been 
      <strong style="color:${color};">${status}</strong> by <strong style="color:#e2e8f0;">${creatorName}</strong>.
    </p>
    <a href="https://novarise-client.vercel.app/dashboard" style="display:inline-block; margin-top:16px; padding:12px 24px; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:#fff; border-radius:10px; text-decoration:none; font-size:13px; font-weight:600;">View My Contributions</a>
  `);
}

// 3. New Contribution Received → Creator
function newContributionEmail(creatorName, supporterName, campaignTitle, amount) {
  return emailWrapper(`
    <h2 style="margin:0 0 8px; font-size:18px; color:#fff;">💰 New Contribution Received!</h2>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">Hi <strong style="color:#e2e8f0;">${creatorName}</strong>,</p>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
      <strong style="color:#a78bfa;">${supporterName}</strong> just pledged 
      <strong style="color:#22d3ee;">${amount} Credits</strong> to your campaign 
      <strong style="color:#e2e8f0;">"${campaignTitle}"</strong>!
    </p>
    <p style="color:#94a3b8; font-size:14px;">Head to your dashboard to review and approve the contribution.</p>
    <a href="https://novarise-client.vercel.app/dashboard" style="display:inline-block; margin-top:16px; padding:12px 24px; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:#fff; border-radius:10px; text-decoration:none; font-size:13px; font-weight:600;">Review Contributions</a>
  `);
}

// 4. Withdrawal Approved → Creator
function withdrawalApprovedEmail(creatorName, withdrawalAmount, dollars) {
  return emailWrapper(`
    <h2 style="margin:0 0 8px; font-size:18px; color:#fff;">✅ Withdrawal Approved!</h2>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">Hi <strong style="color:#e2e8f0;">${creatorName}</strong>,</p>
    <p style="color:#94a3b8; font-size:14px; line-height:1.6;">
      Your withdrawal request of <strong style="color:#22d3ee;">${withdrawalAmount} Credits</strong> 
      (<strong style="color:#34d399;">$${dollars}</strong>) has been approved and processed by the Admin.
    </p>
    <p style="color:#94a3b8; font-size:14px;">The payment should arrive in your registered account shortly.</p>
    <a href="https://novarise-client.vercel.app/dashboard" style="display:inline-block; margin-top:16px; padding:12px 24px; background:linear-gradient(135deg,#7c3aed,#06b6d4); color:#fff; border-radius:10px; text-decoration:none; font-size:13px; font-weight:600;">View Payment History</a>
  `);
}

module.exports = {
  sendEmail,
  campaignStatusEmail,
  contributionStatusEmail,
  newContributionEmail,
  withdrawalApprovedEmail,
};
