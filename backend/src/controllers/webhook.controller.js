const { processStripeEvent } = require("../services/webhook.service");

exports.handleStripeWebhook = async (req, res) => {
  try {
    await processStripeEvent(req);
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
