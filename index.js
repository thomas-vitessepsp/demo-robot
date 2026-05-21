"use strict";

const { runDailyPayment } = require("./paymentGenerator");

runDailyPayment()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error.message);
    if (error.responseBody) {
      console.error(JSON.stringify(error.responseBody, null, 2));
    }
    process.exitCode = 1;
  });
