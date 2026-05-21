"use strict";

const { runDailyPayment } = require("./paymentGenerator");

exports.handler = async function handler() {
  const result = await runDailyPayment();

  return {
    statusCode: 200,
    body: JSON.stringify({
      dryRun: result.dryRun,
      transactionId: result.response && result.response.TransactionId,
      status: result.response && result.response.Status,
      sendValue: result.request.SendValue,
      sendCurrency: result.request.SendCurrency,
      externalReference1: result.request.ExternalReference1
    })
  };
};
