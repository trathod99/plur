# plur

Live music radar: save a free-form taste profile, then **scrape** public Eventbrite discover pages (JSON-LD embedded in HTML), merge duplicates, and rank matches with dates and prices when the listing exposes them.

## Run locally

```bash
npm install
cp env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Taste data is stored in `data/profile.json` on the server.

## Scraping notes

- Sources are **HTML-only** (no Ticketmaster / SeatGeek / API keys). The default fetch uses a small `Plur` User-Agent; set `SCRAPE_USER_AGENT` in `.env.local` if a site blocks the default string.
- Respect Eventbrite’s terms, rate limits, and robots guidance for your deployment. The app issues a modest number of GETs per refresh (regional music browse + keyword pages + optional SF venue pages).
