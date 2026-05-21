# Demo Robot

Demo Robot generates fake Vitesse staging car-insurance payments for `IN/INR` from send account `1077`.

The stochastic model now runs inside a long-lived Node worker, not through GitHub cron. GitHub Actions is kept as a manual fallback for creating one payment on demand.

## Stochastic Worker

`claimWorker.js` runs continuously:

1. Samples the next inter-arrival delay from a Poisson process, implemented as an exponential wait time.
2. Waits for that sampled delay.
3. Creates one staging payment.
4. Increments `payment-counter.json`.
5. Samples again and repeats.

Default frequency is one claim every five minutes on average.

## Required Secrets

Set this environment variable in your cloud worker:

```text
VITESSE_API_TOKEN=your-token
```

## Useful Environment Variables

```text
CLAIM_MEAN_MINUTES=5
RUN_IMMEDIATELY=false
RETRY_DELAY_SECONDS=60
DRY_RUN=false
ROBOT_ENABLED=true
STOP_AFTER_CLAIMS=0
STOP_FILE=/app/stop-worker.flag
```

## Stop Controls

The worker can stop cleanly in four ways:

- Set `ROBOT_ENABLED=false` and restart/redeploy the worker.
- Set `STOP_AFTER_CLAIMS` to a positive number, for example `STOP_AFTER_CLAIMS=10`.
- Create the file configured by `STOP_FILE`, defaulting to `/app/stop-worker.flag` in Docker.
- Send `SIGINT` or `SIGTERM`; the worker wakes from sleep and exits gracefully.

## Local Test

Dry-run one generated claim and stop:

```bash
DRY_RUN=true RUN_IMMEDIATELY=true STOP_AFTER_CLAIMS=1 npm run worker
```

On Windows PowerShell:

```powershell
$env:DRY_RUN = "true"
$env:RUN_IMMEDIATELY = "true"
$env:STOP_AFTER_CLAIMS = "1"
npm run worker
```

## Docker

```bash
docker build -t demo-robot .
docker run --env VITESSE_API_TOKEN=your-token demo-robot
```

For production, mount a small persistent disk over `/app` or set `PAYMENT_COUNTER_FILE` to a persistent path so `payment-counter.json` does not reset after redeploys.

## Manual GitHub Action

The workflow `.github/workflows/vitesse-daily-payment.yml` is manual-only via `workflow_dispatch`. It creates one payment and commits the updated counter. It is not used for stochastic timing.
