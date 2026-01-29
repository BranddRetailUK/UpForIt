const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.createStripeSession = async () => {
  return await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: "UP FOR IT – General Admission"
          },
          unit_amount: 1500
        },
        quantity: 1
      }
    ],
    success_url: "http://localhost:3000/success",
    cancel_url: "http://localhost:3000/cancel"
  });
};
