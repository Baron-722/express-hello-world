#!/usr/bin/env node
import "dotenv/config";

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`  ${c.green("✓")} ${name}${detail ? c.dim(` — ${detail}`) : ""}`);
}
function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.log(`  ${c.red("✗")} ${name} ${c.red(`— ${detail}`)}`);
}
function warn(name, detail) {
  results.push({ ok: true, name, detail, warning: true });
  console.log(`  ${c.yellow("!")} ${name} ${c.yellow(`— ${detail}`)}`);
}

const args = process.argv.slice(2);
const webhookArg = args.find((a) => a.startsWith("--webhook="));
const webhookUrl = webhookArg ? webhookArg.split("=")[1] : null;

console.log("");
console.log(c.bold("Cloudflare Stream — Pre-flight Diagnostic"));
console.log(c.dim("=".repeat(50)));

console.log("\n" + c.bold("[1/4] Environment variables"));

const envVars = {
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_STREAM_API_TOKEN: process.env.CLOUDFLARE_STREAM_API_TOKEN,
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
  VITE_CLOUDFLARE_ACCOUNT_ID: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
};

let envOk = true;
for (const [name, val] of Object.entries(envVars)) {
  if (!val || val.trim() === "") {
    fail(name, "missing or empty");
    envOk = false;
    continue;
  }
  pass(name, `set (${val.length} chars)`);
}

if (!envOk) {
  console.log("\nFix env vars before running the remaining checks.");
  process.exit(1);
}

console.log("\n" + c.bold("[2/4] Token check"));

try {
  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${envVars.CLOUDFLARE_STREAM_API_TOKEN}` },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    fail("Token verification", "invalid token");
  } else {
    pass("Token verification", "valid");
  }
} catch (err) {
  fail("Token verification", err.message);
}

console.log("\n" + c.bold("[3/4] Stream access"));

try {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${envVars.CLOUDFLARE_ACCOUNT_ID}/stream?per_page=1`,
    { headers: { Authorization: `Bearer ${envVars.CLOUDFLARE_STREAM_API_TOKEN}` } }
  );
  const body = await res.json();
  if (!res.ok || body.success === false) {
    fail("Stream access", "cannot access stream");
  } else {
    pass("Stream access", "ok");
  }
} catch (err) {
  fail("Stream access", err.message);
}

console.log("\n" + c.bold("[4/4] Webhook test"));

if (!webhookUrl) {
  warn("Webhook URL", "not provided");
} else {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "diagnostic" }),
    });

    if (res.status === 401) {
      pass("Webhook", "correct (rejecting unsigned)");
    } else {
      fail("Webhook", `unexpected status ${res.status}`);
    }
  } catch (err) {
    fail("Webhook", err.message);
  }
}
