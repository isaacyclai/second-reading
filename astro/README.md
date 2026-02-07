# Astro site

This Astro site is mostly static, with islands used for paginated content.

## Local data

Run the batch processing script to generate local data:

```sh
uv run python/batch_process_sqlite.py
```

## Search indexing (Pagefind)

Pagefind requires a production build to create the search index before it
can be used in dev mode.

```sh
bun run build
bun run dev
```

## Deploy

```sh
wrangler login
bun run build
bun run deploy
```
