import Stripe from "stripe";

let stripe: Stripe | undefined;

export function getStripe() {
  if (stripe) return stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  if (process.env.APP_ENV !== "production" && !secretKey.startsWith("sk_test_")) {
    throw new Error("Non-production ticketing requires a Stripe test secret key");
  }
  stripe = new Stripe(secretKey, { appInfo: { name: "UPFORIT Tickets", version: "1.0.0" } });
  return stripe;
}

export function assertTicketingEnabled() {
  if (process.env.TICKETING_ENABLED !== "true") throw new Error("TICKETING_DISABLED");
}

