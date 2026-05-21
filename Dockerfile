FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./
COPY paymentGenerator.js ./
COPY claimScheduler.js ./
COPY claimWorker.js ./
COPY payment-counter.json ./

ENV NODE_ENV=production
ENV CLAIM_MEAN_MINUTES=5

CMD ["node", "claimWorker.js"]
