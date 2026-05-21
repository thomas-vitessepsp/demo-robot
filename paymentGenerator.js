"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const COUNTER_FILE = path.join(__dirname, "payment-counter.json");

const DEFAULT_CONFIG = {
  apiBaseUrl: "https://staging-api.vitessepsp.com",
  sendAccountId: 1077,
  sendCurrency: "INR",
  recipientCountry: "IN",
  recipientCurrency: "INR",
  routeType: "BankAccount",
  averageAmount: 1000,
  standardDeviation: 200,
  capMultiplier: 5,
  counterFile: COUNTER_FILE
};

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Arjun", "Ishaan", "Rohan", "Priya", "Ananya", "Meera", "Kavya", "Neha", "Riya"];
const LAST_NAMES = ["Sharma", "Patel", "Iyer", "Nair", "Reddy", "Gupta", "Mehta", "Rao", "Khan", "Singh", "Menon", "Das"];

const ADDRESS_BOOK = [
  { line: "14 MG Road", city: "Bengaluru", state: "Karnataka", pin: "560001" },
  { line: "82 Linking Road", city: "Mumbai", state: "Maharashtra", pin: "400050" },
  { line: "27 Anna Salai", city: "Chennai", state: "Tamil Nadu", pin: "600002" },
  { line: "45 Park Street", city: "Kolkata", state: "West Bengal", pin: "700016" },
  { line: "19 Connaught Place", city: "New Delhi", state: "Delhi", pin: "110001" },
  { line: "63 Banjara Hills Road", city: "Hyderabad", state: "Telangana", pin: "500034" },
  { line: "31 FC Road", city: "Pune", state: "Maharashtra", pin: "411004" },
  { line: "11 Ashram Road", city: "Ahmedabad", state: "Gujarat", pin: "380009" }
];

const BANKS = [
  { name: "HDFC Bank", ifscPrefix: "HDFC", swift: "HDFCINBBXXX" },
  { name: "ICICI Bank", ifscPrefix: "ICIC", swift: "ICICINBBXXX" },
  { name: "State Bank of India", ifscPrefix: "SBIN", swift: "SBININBBXXX" },
  { name: "Axis Bank", ifscPrefix: "UTIB", swift: "AXISINBBXXX" },
  { name: "Kotak Mahindra Bank", ifscPrefix: "KKBK", swift: "KKBKINBBXXX" }
];

const CLAIM_TYPES = [
  { purpose: "Motor repair settlement", code: "REPAIR" },
  { purpose: "Cashless garage settlement", code: "GARAGE" },
  { purpose: "Windscreen claim settlement", code: "GLASS" },
  { purpose: "Towing reimbursement", code: "TOWING" },
  { purpose: "Third party liability settlement", code: "TPL" },
  { purpose: "Total loss settlement", code: "TOTAL" },
  { purpose: "Vehicle theft claim settlement", code: "THEFT" },
  { purpose: "Personal accident benefit", code: "PA" }
];

function getConfig(env = process.env) {
  return {
    ...DEFAULT_CONFIG,
    apiBaseUrl: env.VITESSE_API_BASE_URL || DEFAULT_CONFIG.apiBaseUrl,
    apiToken: normalizeBearerToken(env.VITESSE_API_TOKEN),
    sendAccountId: parseInteger(env.SEND_ACCOUNT_ID, DEFAULT_CONFIG.sendAccountId),
    sendCurrency: env.SEND_CURRENCY || DEFAULT_CONFIG.sendCurrency,
    recipientCountry: env.RECIPIENT_COUNTRY || DEFAULT_CONFIG.recipientCountry,
    recipientCurrency: env.RECIPIENT_CURRENCY || DEFAULT_CONFIG.recipientCurrency,
    routeType: env.ROUTE_TYPE || DEFAULT_CONFIG.routeType,
    averageAmount: parseNumber(env.AMOUNT_AVG, DEFAULT_CONFIG.averageAmount),
    standardDeviation: parseNumber(env.AMOUNT_STD_DEV, DEFAULT_CONFIG.standardDeviation),
    capMultiplier: parseNumber(env.AMOUNT_CAP_MULTIPLIER, DEFAULT_CONFIG.capMultiplier),
    counterFile: env.PAYMENT_COUNTER_FILE || DEFAULT_CONFIG.counterFile,
    dryRun: env.DRY_RUN === "true"
  };
}

function normalizeBearerToken(token) {
  if (!token) return token;
  return token.trim().replace(/^Bearer\s+/i, "");
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomItem(items) {
  return items[crypto.randomInt(0, items.length)];
}

function randomDigits(length) {
  let value = "";
  for (let index = 0; index < length; index += 1) value += crypto.randomInt(0, 10).toString();
  return value;
}

function randomAlphaNumeric(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let value = "";
  for (let index = 0; index < length; index += 1) value += chars[crypto.randomInt(0, chars.length)];
  return value;
}

function makeReference(prefix) {
  const value = `${prefix}${randomAlphaNumeric(7)}`;
  assertReference(value, `${prefix} reference`);
  return value;
}

function assertReference(value, label) {
  if (!/^[A-Z0-9]{8}$/.test(value)) throw new Error(`${label} must be exactly 8 uppercase alphanumeric characters.`);
}

function readPaymentReference(counterFile) {
  if (!fs.existsSync(counterFile)) return "00001500";

  const parsed = JSON.parse(fs.readFileSync(counterFile, "utf8"));
  const reference = String(parsed.nextPaymentReference || "").trim();
  if (!/^\d{8}$/.test(reference)) throw new Error(`Invalid nextPaymentReference in ${counterFile}. Expected an 8 digit string.`);
  return reference;
}

function nextPaymentReference(reference) {
  const next = Number.parseInt(reference, 10) + 1;
  if (!Number.isSafeInteger(next) || next > 99999999) throw new Error("Payment reference counter exceeded 99999999.");
  return next.toString().padStart(8, "0");
}

function writePaymentReference(counterFile, reference) {
  fs.writeFileSync(counterFile, `${JSON.stringify({ nextPaymentReference: reference }, null, 2)}\n`, "utf8");
}

function randomNormal(mean, standardDeviation) {
  let first = 0;
  let second = 0;
  while (first === 0) first = crypto.randomInt(1, 1_000_000) / 1_000_000;
  while (second === 0) second = crypto.randomInt(1, 1_000_000) / 1_000_000;
  return mean + Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second) * standardDeviation;
}

function generateAmount(config) {
  const cap = config.averageAmount * config.capMultiplier;
  const sampled = randomNormal(config.averageAmount, config.standardDeviation);
  return Math.round(Math.max(1, Math.min(cap, sampled)) * 100) / 100;
}

function generateRecipient() {
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const address = randomItem(ADDRESS_BOOK);
  const bank = randomItem(BANKS);

  return {
    name: `${firstName} ${lastName}`,
    address: `${address.line}, ${address.city}, ${address.state} ${address.pin}, India`,
    account: {
      Swift: bank.swift,
      AccountNumber: randomDigits(14),
      BankName: bank.name,
      IfscCode: `${bank.ifscPrefix}0${randomAlphaNumeric(6)}`
    }
  };
}

function buildPaymentRequest(config = getConfig(), paymentReference = readPaymentReference(config.counterFile)) {
  assertReference(paymentReference, "Payment reference");
  const claimType = randomItem(CLAIM_TYPES);
  const recipient = generateRecipient();

  return {
    Recipient: {
      Type: "Person",
      Name: recipient.name,
      Country: config.recipientCountry,
      Currency: config.recipientCurrency,
      RecipientReference: paymentReference,
      Address: recipient.address,
      Account: {
        ...recipient.account,
        PaymentPurpose: `${claimType.purpose} ${paymentReference}`
      }
    },
    ExternalReference1: paymentReference,
    ExternalReference2: makeReference("P"),
    ExternalReference3: makeReference("I"),
    SendAccountId: config.sendAccountId,
    SendCurrency: config.sendCurrency,
    SendValue: generateAmount(config),
    RouteType: config.routeType
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = text;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!response.ok) {
    const error = new Error(`Vitesse API returned ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }

  return { status: response.status, statusText: response.statusText, body };
}

async function getRules(config) {
  const url = new URL(`/api/rules/${config.recipientCountry}/${config.recipientCurrency}`, config.apiBaseUrl);
  url.searchParams.set("accountId", String(config.sendAccountId));

  const result = await requestJson(url, {
    method: "GET",
    headers: { accept: "application/json", Authorization: `Bearer ${config.apiToken}` }
  });

  return result.body;
}

function readPath(source, rulePath) {
  return rulePath
    .replace(/^request\./, "")
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function validateRequiredRules(paymentRequest, rules) {
  const missing = rules
    .filter((rule) => rule.Options === "Mandatory")
    .filter((rule) => {
      const value = readPath(paymentRequest, rule.Path);
      return value == null || value === "";
    })
    .map((rule) => `${rule.FieldName} (${rule.Path})`);

  if (missing.length > 0) throw new Error(`Generated request is missing mandatory fields: ${missing.join(", ")}`);
}

async function createTransactionRequest(paymentRequest, config) {
  return requestJson(new URL("/api/transactionRequests", config.apiBaseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Bearer ${config.apiToken}`
    },
    body: JSON.stringify(paymentRequest)
  });
}

async function runDailyPayment(env = process.env) {
  const config = getConfig(env);
  const paymentReference = readPaymentReference(config.counterFile);
  const paymentRequest = buildPaymentRequest(config, paymentReference);

  if (config.dryRun) return { dryRun: true, nextPaymentReference: paymentReference, request: paymentRequest };
  if (!config.apiToken) throw new Error("Missing required environment variable VITESSE_API_TOKEN.");

  const rules = await getRules(config);
  validateRequiredRules(paymentRequest, rules);

  const result = await createTransactionRequest(paymentRequest, config);
  const nextReference = nextPaymentReference(paymentReference);
  writePaymentReference(config.counterFile, nextReference);

  return { dryRun: false, paymentReference, nextPaymentReference: nextReference, request: paymentRequest, response: result.body };
}

module.exports = {
  buildPaymentRequest,
  generateAmount,
  getConfig,
  normalizeBearerToken,
  readPaymentReference,
  runDailyPayment,
  validateRequiredRules,
  writePaymentReference
};
