"use strict";

const { runDailyPayment } = require("./paymentGenerator");
const { samplePoissonDelaySeconds } = require("./claimScheduler");
const fs = require("fs");
const path = require("path");

const DEFAULT_MEAN_MINUTES = 5;
const DEFAULT_STOP_FILE = path.join(__dirname, "stop-worker.flag");

let shutdownRequested = false;
let wakeSleepingWorker = null;

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y"].includes(String(value).trim().toLowerCase());
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      wakeSleepingWorker = null;
      resolve();
    }, milliseconds);

    wakeSleepingWorker = () => {
      clearTimeout(timeout);
      wakeSleepingWorker = null;
      resolve();
    };
  });
}

function isoNow() {
  return new Date().toISOString();
}

async function createOneClaim() {
  const result = await runDailyPayment();
  console.log(JSON.stringify({
    event: "claim_created",
    at: isoNow(),
    dryRun: result.dryRun,
    paymentReference: result.paymentReference,
    nextPaymentReference: result.nextPaymentReference,
    externalReference2: result.request?.ExternalReference2,
    externalReference3: result.request?.ExternalReference3,
    recipientReference: result.request?.Recipient?.RecipientReference
  }));
}

function parseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getStopReason(env, completedClaims) {
  if (shutdownRequested) return "shutdown signal received";
  if (parseBoolean(env.ROBOT_ENABLED, true) === false) return "ROBOT_ENABLED=false";

  const stopAfterClaims = parseNonNegativeInteger(env.STOP_AFTER_CLAIMS, 0);
  if (stopAfterClaims > 0 && completedClaims >= stopAfterClaims) {
    return `STOP_AFTER_CLAIMS reached (${stopAfterClaims})`;
  }

  const stopFile = env.STOP_FILE || DEFAULT_STOP_FILE;
  if (fs.existsSync(stopFile)) return `stop file exists: ${stopFile}`;

  return null;
}

async function runWorker(env = process.env) {
  const meanMinutes = parsePositiveNumber(env.CLAIM_MEAN_MINUTES, DEFAULT_MEAN_MINUTES);
  const runImmediately = parseBoolean(env.RUN_IMMEDIATELY, false);
  let completedClaims = 0;

  console.log(JSON.stringify({
    event: "worker_started",
    at: isoNow(),
    meanMinutes,
    dryRun: env.DRY_RUN === "true",
    runImmediately,
    stopAfterClaims: parseNonNegativeInteger(env.STOP_AFTER_CLAIMS, 0),
    stopFile: env.STOP_FILE || DEFAULT_STOP_FILE
  }));

  let firstRun = true;
  while (true) {
    const stopReason = getStopReason(env, completedClaims);
    if (stopReason) {
      console.log(JSON.stringify({
        event: "worker_stopped",
        at: isoNow(),
        reason: stopReason,
        completedClaims
      }));
      return;
    }

    if (!firstRun || !runImmediately) {
      const delaySeconds = samplePoissonDelaySeconds(meanMinutes);
      const nextClaimAt = new Date(Date.now() + delaySeconds * 1000);
      console.log(JSON.stringify({
        event: "next_claim_scheduled",
        at: isoNow(),
        meanMinutes,
        delaySeconds,
        nextClaimAt: nextClaimAt.toISOString()
      }));
      await sleep(delaySeconds * 1000);
    }

    const postSleepStopReason = getStopReason(env, completedClaims);
    if (postSleepStopReason) {
      console.log(JSON.stringify({
        event: "worker_stopped",
        at: isoNow(),
        reason: postSleepStopReason,
        completedClaims
      }));
      return;
    }

    firstRun = false;

    try {
      await createOneClaim();
      completedClaims += 1;
    } catch (error) {
      console.error(JSON.stringify({
        event: "claim_failed",
        at: isoNow(),
        message: error.message,
        responseBody: error.responseBody
      }));

      const retryDelaySeconds = parsePositiveNumber(env.RETRY_DELAY_SECONDS, 60);
      console.log(JSON.stringify({
        event: "retry_scheduled",
        at: isoNow(),
        delaySeconds: retryDelaySeconds
      }));
      await sleep(retryDelaySeconds * 1000);
    }
  }
}

function requestShutdown() {
  shutdownRequested = true;
  if (wakeSleepingWorker) wakeSleepingWorker();
}

process.on("SIGINT", requestShutdown);
process.on("SIGTERM", requestShutdown);

if (require.main === module) {
  runWorker().catch((error) => {
    console.error(JSON.stringify({
      event: "worker_crashed",
      at: isoNow(),
      message: error.message
    }));
    process.exitCode = 1;
  });
}

module.exports = { runWorker };
