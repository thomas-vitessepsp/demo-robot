# Demo Robot Flat Package

This is the root-only version of Demo Robot. All files are in this folder so you can upload them to GitHub without creating source-code subfolders.

## Important GitHub Actions Note

GitHub requires workflow files to live under `.github/workflows`. Because you asked for all files in the root, the workflow is provided here as:

```text
vitesse-daily-payment.yml
```

To enable the daily schedule in GitHub:

1. Upload all files in this folder to your GitHub repo root.
2. In GitHub, go to **Actions**.
3. If GitHub offers **set up a workflow yourself**, choose that.
4. Paste the contents of `vitesse-daily-payment.yml`.
5. Save it as:

```text
.github/workflows/vitesse-daily-payment.yml
```

GitHub will create the required folders for you.

## Secret Setup

In GitHub, open **Settings** > **Secrets and variables** > **Actions**.

Create this repository secret:

```text
VITESSE_API_TOKEN
```

Optional for testing: create a repository variable named `DRY_RUN` and set it to `true`.

## Local Test

Install Node.js 18 or newer, then run:

```bash
npm run dry-run
```

For a live local run:

```bash
VITESSE_API_TOKEN=your-token node index.js
```

On Windows PowerShell:

```powershell
$env:VITESSE_API_TOKEN = "your-token"
node index.js
```

## What It Does

- Creates one fake `IN/INR` car-insurance payment from send account `1077`.
- Uses `https://staging-api.vitessepsp.com` by default.
- Generates names, Indian addresses, bank details, claim references, policy references, invoice references, payment purpose, and recipient reference.
- Samples the payment amount from a normal distribution with average `1000`, standard deviation `200`, and cap `5000`.
- Reads the bearer token from `VITESSE_API_TOKEN`; it is not stored in code.
