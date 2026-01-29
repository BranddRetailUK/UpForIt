const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createOrderAndTickets } = require("../db");
const { sendWhatsAppTicket } = require("./whatsapp.service");

exports.processStripeEvent = async (req) => {
  const sig = req.headers["stripe-signature"];

  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Persist order + tickets
    const order = await createOrderAndTickets({
      stripeSessionId: session.id,
      email: session.customer_details?.email || null,
      amount: session.amount_total
    });

    // WhatsApp delivery (stubbed)
    if (order.phone) {
      await sendWhatsAppTicket(order);
    }
  }
};
