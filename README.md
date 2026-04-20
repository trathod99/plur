# plur

Live music radar: save a free-form taste profile, then scrape **[19hz.info](https://19hz.info)** regional event tables (server-rendered HTML), dedupe rows, and rank matches with dates and price hints when the table includes them.

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

## Which calendars load

- **Bay Area** (`eventlisting_BayArea.php`): San Francisco, Oakland, Berkeley, San Jose, Sacramento, Napa, Sonoma, “Bay Area”, or US profiles whose taste mentions electronic genres.
- **Houston** (`eventlisting_Houston.php`): when home city includes Houston.

## Scraping notes

- Only **19hz** is used: stable table markup, no JS-rendered discovery pages.
- Optional `SCRAPE_USER_AGENT` in `.env.local` if requests are blocked.
- Respect 19hz’s terms and robots guidance for your deployment.
