"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_MEAN_MINUTES = 5;
const DEFAULT_STATE_FILE = path.join(__dirname, "claim-schedule.json");
const DEFAULT_WORKFLOW_FILE = path.join(__dirname, ".github", "workflows", "vitesse-daily-payment.yml");
const NEXT_CLAIM_MARKER = "# demo-robot-next-claim";

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function randomUnitInterval() {
  return crypto.randomInt(1, 1_000_000_000) / 1_000_000_000;
}

function samplePoissonDelaySeconds(meanMinutes = DEFAULT_MEAN_MINUTES) {
  const meanSeconds = meanMinutes * 60;
  return Math.max(1, Math.ceil(-Math.log(randomUnitInterval()) * meanSeconds));
}

function roundUpToMinute(date) {
  const rounded = new Date(date);
  const hasPartialMinute = rounded.getUTCSeconds() > 0 || rounded.getUTCMilliseconds() > 0;
  rounded.setUTCSeconds(0, 0);
  if (hasPartialMinute) rounded.setUTCMinutes(rounded.getUTCMinutes() + 1);
  return rounded;
}

function cronForDate(date) {
  return [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    "*"
  ].join(" ");
}

function readScheduleState(stateFile = DEFAULT_STATE_FILE) {
  if (!fs.existsSync(stateFile)) return null;
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeScheduleState(state, stateFile = DEFAULT_STATE_FILE) {
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function updateWorkflowCron(cron, workflowFile = DEFAULT_WORKFLOW_FILE) {
  const workflow = fs.readFileSync(workflowFile, "utf8");
  const markerPattern = new RegExp(`- cron: ".*" ${NEXT_CLAIM_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  if (!markerPattern.test(workflow)) {
    throw new Error(`Could not find ${NEXT_CLAIM_MARKER} in ${workflowFile}.`);
  }

  fs.writeFileSync(
    workflowFile,
    workflow.replace(markerPattern, `- cron: "${cron}" ${NEXT_CLAIM_MARKER}`),
    "utf8"
  );
}

function scheduleNextClaim(env = process.env, now = new Date()) {
  const meanMinutes = parsePositiveNumber(env.CLAIM_MEAN_MINUTES, DEFAULT_MEAN_MINUTES);
  const delaySeconds = samplePoissonDelaySeconds(meanMinutes);
  const nextClaimAt = roundUpToMinute(new Date(now.getTime() + delaySeconds * 1000));
  const cron = cronForDate(nextClaimAt);
  const shouldUpdateWorkflow = env.UPDATE_WORKFLOW_CRON !== "false";
  const state = {
    nextClaimAt: nextClaimAt.toISOString(),
    cron,
    meanMinutes,
    sampledDelaySeconds: delaySeconds,
    scheduledAt: now.toISOString(),
    workflowCronUpdated: shouldUpdateWorkflow
  };

  writeScheduleState(state, env.CLAIM_SCHEDULE_FILE || DEFAULT_STATE_FILE);
  if (shouldUpdateWorkflow) updateWorkflowCron(cron, env.WORKFLOW_FILE || DEFAULT_WORKFLOW_FILE);
  return state;
}

function isClaimDue(env = process.env, now = new Date()) {
  const eventName = env.GITHUB_EVENT_NAME || "local";
  if (eventName === "workflow_dispatch" || eventName === "push" || env.FORCE_CLAIM === "true") {
    return { shouldRun: true, reason: `${eventName} trigger` };
  }

  const state = readScheduleState(env.CLAIM_SCHEDULE_FILE || DEFAULT_STATE_FILE);
  if (!state || !state.nextClaimAt) return { shouldRun: true, reason: "no schedule state found" };

  const nextClaimAt = new Date(state.nextClaimAt);
  if (Number.isNaN(nextClaimAt.getTime())) {
    throw new Error(`Invalid nextClaimAt in ${env.CLAIM_SCHEDULE_FILE || DEFAULT_STATE_FILE}.`);
  }

  const toleranceMs = 30_000;
  return {
    shouldRun: now.getTime() + toleranceMs >= nextClaimAt.getTime(),
    reason: `next claim due at ${nextClaimAt.toISOString()}`,
    nextClaimAt: nextClaimAt.toISOString()
  };
}

function writeGitHubOutput(values, outputFile = process.env.GITHUB_OUTPUT) {
  if (!outputFile) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputFile, `${lines.join("\n")}\n`, "utf8");
}

function runCli() {
  const command = process.argv[2] || "schedule";
  if (command === "gate") {
    const result = isClaimDue();
    writeGitHubOutput({ should_run: result.shouldRun ? "true" : "false" });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "schedule") {
    console.log(JSON.stringify(scheduleNextClaim(), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  cronForDate,
  isClaimDue,
  readScheduleState,
  roundUpToMinute,
  samplePoissonDelaySeconds,
  scheduleNextClaim
};
