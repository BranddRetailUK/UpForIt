require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const checkoutRoutes = require("./src/routes/checkout.routes");
const webhookRoutes = require("./src/routes/webhook.routes");

const app = express();

app.use(cors());

// Stripe webhook needs RAW body
app.use(
  "/api/webhook",
  bodyParser.raw({ type: "application/json" })
);

// Normal JSON everywhere else
app.use(express.json());

app.use("/api/checkout", checkoutRoutes);
app.use("/api/webhook", webhookRoutes);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
