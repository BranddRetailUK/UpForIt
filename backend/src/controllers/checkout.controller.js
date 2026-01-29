const { createStripeSession } = require("../services/stripe.service");
const { queueWhatsAppIntent } = require("../services/whatsapp.service");

exports.createCheckoutSession = async (req, res) => {
  try {
    const session = await createStripeSession();

    // Placeholder: record WhatsApp intent after payment success
    queueWhatsAppIntent({
      event: "UPFORIT_EVENT",
      source: "website"
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create checkout session" });
  }
};
