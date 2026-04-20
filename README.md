# plur

Live music radar: save a free-form taste profile, then **scrape** public Eventbrite discover pages (JSON-LD embedded in HTML), merge duplicates, and rank matches with dates and prices when the listing exposes them.

## Run locally

```bash
npm install
cp env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Taste data is stored in `data/profile.json` on the server (override with `PLUR_DATA_DIR`).

## Headless CLI

Same profile file and the same `gatherAndScoreEvents` pipeline as the web app:

```bash
npm run plur -- profile show
npm run plur -- profile set --city "San Francisco" --country US --genres "techno, house" --artists "Charlotte de Witte"
npm run plur -- events list --limit 20
npm run plur -- events list --json
```

## Scraping notes

- Sources are **HTML-only** (no API keys). Listings come from **Eventbrite** discover pages (JSON-LD) and **[19hz.info](https://19hz.info)** regional calendars (Bay Area / Houston when your profile matches, or URLs in `NINETEEN_HZ_URLS`). The default fetch uses a small `Plur` User-Agent; set `SCRAPE_USER_AGENT` in `.env.local` if a site blocks the default string.
- Respect each site’s terms, rate limits, and robots guidance for your deployment. The app issues a modest number of GETs per refresh (19hz + regional Eventbrite browse + keyword pages + optional SF venue pages).
