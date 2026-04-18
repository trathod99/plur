const DEFAULT_UA =
  "Mozilla/5.0 (compatible; Plur/1.0; +https://github.com/trathod99/plur) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": process.env.SCRAPE_USER_AGENT?.trim() || DEFAULT_UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}
