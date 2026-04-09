# API Key Setup Guide

Vertiport Eval requires three types of API keys: one AI provider key (your choice), plus free government data API keys for EIA, NREL, and Mapbox.

The AI provider key is set inside the app. The data API keys go in your `.env` file.

---

## Quick Reference

| Key | Where | Cost | Required |
|-----|-------|------|----------|
| AI provider (one of three) | In-app BYOK screen | ~$0.03/eval | Yes |
| EIA Open Data | `.env` | Free | Yes |
| NREL Developer | `.env` | Free | Yes |
| Mapbox | `.env` | Free tier | Yes (3D map) |

---

## Part 1 — AI Provider Key (in-app)

The app runs three parallel LLM calls per evaluation (passenger, cargo, and combo demand modes). Each full evaluation uses roughly 4,000–6,000 tokens total.

On first launch, the BYOK setup screen will appear automatically. You can also reach it anytime via the **⚙** button in the header.

Choose one provider:

---

### Option A — Anthropic (Recommended)

**Model used:** claude-sonnet-4-6

**Cost estimate:** ~$0.03–0.05 per full evaluation

**Steps:**

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to **Settings → API Keys**
4. Click **Create Key** — give it a name like `vertiport-eval`
5. Copy the key immediately — it starts with `sk-ant-api03-` and is shown only once
6. Paste it into the Anthropic tab in the BYOK setup screen
7. Click **Validate & Save**

**Free credits:** New accounts receive $5 in free credits — enough for 100+ evaluations before any charges.

---

### Option B — OpenAI

**Model used:** gpt-4o

**Cost estimate:** ~$0.04–0.06 per full evaluation

**Steps:**

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account or sign in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create new secret key** — name it `vertiport-eval`
5. Copy the key — it starts with `sk-proj-` and is shown only once
6. Paste it into the OpenAI tab in the BYOK setup screen
7. Click **Validate & Save**

**Note:** OpenAI requires a paid account with billing enabled to use GPT-4o. Free-tier accounts are limited to older models.

---

### Option C — Google Gemini

**Model used:** gemini-2.0-flash

**Cost estimate:** ~$0.001–0.003 per full evaluation (significantly cheaper)

**Steps:**

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API Key** in the left sidebar
4. Click **Create API Key** — select a Google Cloud project or create a new one
5. Copy the key — it starts with `AIza`
6. Paste it into the Google Gemini tab in the BYOK setup screen
7. Click **Validate & Save**

**Free tier:** Gemini 2.0 Flash has a generous free tier (15 requests/minute, 1,500/day) — sufficient for typical use without any billing setup.

---

## Part 2 — Data API Keys (`.env` file)

These keys are free and cover government data sources. They go in a `.env` file in the project root.

If you haven't already:

```bash
cp .env.example .env
```

Then open `.env` and fill in the three values below.

---

### EIA Open Data API

Used for: power grid capacity scoring (US electricity retail sales data)

**Cost:** Free, no rate limits for normal use

**Steps:**

1. Go to [eia.gov/opendata/register.php](https://www.eia.gov/opendata/register.php)
2. Fill in your name, email, and intended use
3. Click **Register**
4. Check your email for the API key (arrives within a few minutes)
5. Add it to `.env`:

```
VITE_EIA_API_KEY=your_key_here
```

---

### NREL Developer API

Used for: distributed energy resource scoring (solar GHI, utility rates, net metering)

**Cost:** Free — 1,000 requests/day on the default tier

**Steps:**

1. Go to [developer.nrel.gov/signup](https://developer.nrel.gov/signup)
2. Fill in the registration form — select **Research** or **Other** for intended use
3. Submit — the key is emailed immediately
4. Add it to `.env`:

```
VITE_NREL_API_KEY=your_key_here
```

---

### Mapbox

Used for: 3D obstacle surface map (FAA EB 105A approach surfaces)

**Cost:** Free tier — 50,000 map loads/month

**Steps:**

1. Go to [mapbox.com](https://www.mapbox.com) and create a free account
2. After sign-in, your **Default public token** is shown on the home dashboard
3. Copy it — it starts with `pk.`
4. Add it to `.env`:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

**Note:** The 2D Leaflet map and all scoring functions work without Mapbox. The 3D obstacle surface map will not load if this token is missing or invalid.

---

## Verify Your Setup

After adding all four keys, run the app:

```bash
npm run electron:dev
```

On first launch, the BYOK screen will appear. Enter your AI provider key and click **Validate & Save**. A successful validation returns **KEY VERIFIED** and opens the main app.

To confirm the data APIs are working, run an evaluation and check the progress log — you should see live results for EIA, NREL, FEMA, and HCAD rather than fallback estimates.

---

## Changing Your AI Provider

Click the **⚙** button in the top-right of the app header. This reopens the BYOK setup screen. Select a different provider tab, enter your key, and validate. The new key takes effect immediately.

---

## Troubleshooting

**"No API key configured"** — The BYOK screen was closed without saving. Click ⚙ in the header and complete setup.

**"API 401"** — The key is invalid or was entered incorrectly. Return to the provider console, verify the key is active, and re-enter it.

**"API 429"** — Rate limit hit. Wait a few minutes and try again. If using Gemini free tier, you have reached the 15 req/min limit.

**"Request timed out"** — The LLM call exceeded 35 seconds. This occasionally happens under load. Run the evaluation again.

**EIA / NREL showing "baseline" in logs** — The `.env` key is missing or the API is temporarily unavailable. Scoring falls back to national baseline estimates automatically.

**3D map blank** — Mapbox token is missing or invalid. The 2D map and all scoring remain fully functional.
