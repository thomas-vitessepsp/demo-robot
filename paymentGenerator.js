"use strict";

const crypto = require("crypto");

const DEFAULT_CONFIG = {
  apiBaseUrl: "https://staging-api.vitessepsp.com",
  sendAccountId: 1077,
  sendCurrency: "INR",
  recipientCountry: "IN",
  recipientCurrency: "INR",
  routeType: "BankAccount",
  averageAmount: 1000,
  standardDeviation: 200,
  capMultiplier: 5
};

const FIRST_NAMES = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Arjun",
  "Ishaan",
  "Rohan",
  "Priya",
  "Ananya",
  "Meera",
  "Kavya",
  "Neha",
  "Riya"
];

const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Iyer",
  "Nair",
  "Reddy",
  "Gupta",
  "Mehta",
  "Rao",
  "Khan",
  "Singh",
  "Menon",
  "Das"
];

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
  { purpose: "Motor repair settlement", reference: "Claimant repair settlement", code: "REPAIR" },
  { purpose: "Cashless garage settlement", reference: "Garage repair settlement", code: "GARAGE" },
  { purpose: "Windscreen claim settlement", reference: "Windscreen replacement claim", code: "GLASS" },
  { purpose: "Towing reimbursement", reference: "Roadside towing reimbursement", code: "TOWING" },
  { purpose: "Third party liability settlement", reference: "Third party motor claim", code: "TPL" },
  { purpose: "Total loss settlement", reference: "Total loss motor settlement", code: "TOTAL" },
  { purpose: "Vehicle theft claim settlement", reference: "Theft claim settlement", code: "THEFT" },
  { purpose: "Personal accident benefit", reference: "PA cover claim settlement", code: "PA" }
];

function getConfig(env = process.env) {
  return {
    ...DEFAULT_CONFIG,
    apiBaseUrl: env.VITESSE_API_BASE_URL || DEFAULT_CONFIG.apiBaseUrl,
    apiToken: env.VITESSE_API_TOKEN,
    sendAccountId: parseInteger(env.SEND_ACCOUNT_ID, DEFAULT_CONFIG.sendAccountId),
    sendCurrency: env.SEND_CURRENCY || DEFAULT_CONFIG.sendCurrency,
    recipientCountry: env.RECIPIENT_COUNTRY || DEFAULT_CONFIG.recipientCountry,
    recipientCurrency: env.RECIPIENT_CURRENCY || DEFAULT_CONFIG.recipientCurrency,
    routeType: env.ROUTE_TYPE || DEFAULT_CONFIG.routeType,
    averageAmount: parseNumber(env.AMOUNT_AVG, DEFAULT_CONFIG.averageAmount),
    standardDeviation: parseNumber(env.AMOUNT_STD_DEV, DEFAULT_CONFIG.standardDeviation),
    capMultiplier: parseNumber(env.AMOUNT_CAP_MULTIPLIER, DEFAULT_CONFIG.capMultiplier),
    dryRun: env.DRY_RUN === "true"
  };
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
  for (let index = 0; index < length; index += 1) {
    value += crypto.randomInt(0, 10).toString();
  }
  return value;
}

function randomAlphaNumeric(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += chars[crypto.randomInt(0, chars.length)];
  }
  return value;
}

function randomNormal(mean, standardDeviation) {
  let first = 0;
  let second = 0;

  while (first === 0) first = crypto.randomInt(1, 1_000_000) / 1_000_000;
  while (second === 0) second = crypto.randomInt(1, 1_000_000) / 1_000_000;

  const standardNormal =
    Math.sqrt(-2.0 * Math.log(first)) * Math.cos(2.0 * Math.PI * second);

  return mean + standardNormal * standardDeviation;
}

function generateAmount(config) {
  const cap = config.averageAmount * config.capMultiplier;
  const sampled = randomNormal(config.averageAmount, config.standardDeviation);
  const bounded = Math.max(1, Math.min(cap, sampled));

  return Math.round(bounded * 100) / 100;
}

function compactDate(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function generateInsuranceContext(date = new Date()) {
  const claimType = randomItem(CLAIM_TYPES);
  const dayCode = compactDate(date);
  const claimNumber = `${claimType.code}-${dayCode}-${randomAlphaNumeric(6)}`;
  const policyNumber = `POL-IN-${dayCode.slice(2)}-${randomDigits(5)}`;
  const invoiceNumber = `INV-${claimType.code}-${randomDigits(6)}`;

  return {
    claimType,
    claimNumber,
    policyNumber,
    invoiceNumber
  };
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

function buildPaymentRequest(config = getConfig(), date = new Date()) {
  const insurance = generateInsuranceContext(date);
  const recipient = generateRecipient();

  return {
    Recipient: {
      Type: "Person",
      Name: recipient.name,
      Country: config.recipientCountry,
      Currency: config.recipientCurrency,
      RecipientReference: `${insurance.claimType.reference} ${insurance.claimNumber}`,
      Address: recipient.address,
      Account: {
        ...recipient.account,
        PaymentPurpose: `${insurance.claimType.purpose} ${insurance.claimNumber}`
      }
    },
    ExternalReference1: insurance.claimNumber,
    ExternalReference2: insurance.policyNumber,
    ExternalReference3: insurance.invoiceNumber,
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
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const error = new Error(`Vitesse API returned ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.responseBody = body;
    throw error;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    body
  };
}

async function getRules(config) {
  const url = new URL(
    `/api/rules/${config.recipientCountry}/${config.recipientCurrency}`,
    config.apiBaseUrl
  );
  url.searchParams.set("accountId", String(config.sendAccountId));

  const result = await requestJson(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${config.apiToken}`
    }
  });

  return result.body;
}

function readPath(source, path) {
  return path
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

  if (missing.length > 0) {
    throw new Error(`Generated request is missing mandatory fields: ${missing.join(", ")}`);
  }
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
  const paymentRequest = buildPaymentRequest(config);

  if (config.dryRun) {
    return {
      dryRun: true,
      request: paymentRequest
    };
  }

  if (!config.apiToken) {
    throw new Error("Missing required environment variable VITESSE_API_TOKEN.");
  }

  const rules = await getRules(config);
  validateRequiredRules(paymentRequest, rules);

  const result = await createTransactionRequest(paymentRequest, config);

  return {
    dryRun: false,
    request: paymentRequest,
    response: result.body
  };
}

module.exports = {
  buildPaymentRequest,
  generateAmount,
  getConfig,
  runDailyPayment,
  validateRequiredRules
};
