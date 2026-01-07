import express from "express";
import stripeWebhookRouter from "./routes/webhooks/stripe-simple";
import bodyParser from "body-parser";
import { env } from "./env";

const app = express();

/**
 * RECOMMENDED APPROACH: Use express.json() with verify callback
 * This captures raw body while also parsing JSON in a single pass
 */
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    // Capture raw body for webhook signature verification
    req.rawBody = buf;
  }
}));

// Webhook routes - raw body is already captured above
app.use("/api/webhooks", stripeWebhookRouter);

// Other routes...
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;

