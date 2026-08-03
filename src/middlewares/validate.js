const { z } = require("zod");

// Middleware to validate req.body against a Zod schema
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
        return res.status(400).json({
          error: "Validation failed.",
          details: issues,
        });
      }
      next(error);
    }
  };
}

// Campaign creation schema
const campaignCreateSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long"),
  story: z.string().min(20, "Campaign story must be at least 20 characters long"),
  category: z.string().min(2, "Category is required"),
  funding_goal: z.number().positive("Funding goal must be greater than 0"),
  minimum_contribution: z.number().nonnegative("Minimum contribution cannot be negative").default(10),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), "Deadline must be a valid date string"),
  reward_info: z.string().optional().default("No custom reward specified"),
  image_url: z.string().url("Image URL must be a valid URL").optional().or(z.literal("")),
});

// Contribution creation schema
const contributionCreateSchema = z.object({
  campaignId: z.string().min(1, "Campaign ID is required"),
  amount: z.number().positive("Contribution amount must be greater than 0"),
});

// Withdrawal request schema
const withdrawalCreateSchema = z.object({
  credits_to_withdraw: z.number().min(200, "Minimum withdrawal is 200 credits ($10)"),
  payment_system: z.enum(["Stripe", "PayPal", "Bank Transfer", "BKash", "Nagad"]).default("Stripe"),
  account_number: z.string().min(4, "Account number is required"),
});

// Credit purchase payment schema
const paymentSchema = z.object({
  credits: z.number().positive("Credits amount must be positive"),
  cardNumber: z.string().min(13, "Card number must be at least 13 digits"),
  expiry: z.string().min(4, "Expiry date is required"),
  cvc: z.string().min(3, "CVC must be at least 3 digits"),
});

module.exports = {
  validateBody,
  campaignCreateSchema,
  contributionCreateSchema,
  withdrawalCreateSchema,
  paymentSchema,
};
