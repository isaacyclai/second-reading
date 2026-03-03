# Astro Frontend

The Second Reading frontend is built with [Astro](https://astro.build/) and styled with Tailwind CSS. It is mostly static, with islands used for paginated content and client-side search.

## Prerequisites

The SQLite database (`data/parliament.db`) must be generated first using the Python scripts in `/python`.

## Development

```sh
cd astro
bun install
bun run build   # required for Pagefind search index
bun run dev
```

Open [http://localhost:4321](http://localhost:4321) to view the app.

## Search Indexing (Pagefind)

Pagefind requires a production build to create the search index before it can be used in dev mode. Run `bun run build` at least once before `bun run dev`.

## Deploy

```sh
wrangler login
bun run build
bun run deploy
```
