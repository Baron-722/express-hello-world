const express = require("express");
const crypto = require("crypto");

const app = express();

app.post(
  "/api/stream/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["cf-webhook-signature"];
    const secret = process.env.STREAM_WEBHOOK_SECRET;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(401).send("Invalid signature");
    }

    const payload = JSON.parse(req.body.toString());
    console.log("Webhook received:", payload);

    res.sendStatus(200);
  }
);

app.get("/", (req, res) => {
  res.send("API running");
});

app.listen(10000, () => {
  console.log("Server running");
});
