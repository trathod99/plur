# plur

Live music radar: save a free-form taste profile, then pull concerts from Ticketmaster, SeatGeek, Bandsintown, Edmtrain (electronic-first), and optionally Songkick (Bay Area metro calendar), merge duplicates, and rank matches with dates and price hints when APIs provide them.

## Run locally

```bash
npm install
cp env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Taste data is stored in `data/profile.json` on the server.

## API keys

Set optional keys in `.env.local` to enable each source:

- `TICKETMASTER_API_KEY` — [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
- `SEATGEEK_CLIENT_ID` — [SeatGeek API](https://platform.seatgeek.com/)
- `BANDSINTOWN_APP_ID` — [Bandsintown for Artists](https://help.artists.bandsintown.com/)
- `EDMTRAIN_CLIENT` — [Edmtrain Developer API](https://edmtrain.com/developer-api) (review their API terms before shipping)
- `SONGKICK_API_KEY` — [Songkick API access](https://www.songkick.com/api_key_requests/new)

Optional: `EDMTRAIN_SF_LOCATION_ID` and `EDMTRAIN_SF_VENUE_IDS` (comma-separated) to pin San Francisco Edmtrain coverage.

Missing keys surface as warnings in the UI instead of failing the whole request.
