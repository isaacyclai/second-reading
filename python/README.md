# Python Scripts

This directory contains scripts for obtaining data from the Hansard, ingesting it into the SQLite database, and generating AI summaries. To install dependencies:

```bash
cd python
uv sync
```

## Main Scripts

### `batch_process_sqlite.py`

Ingests parliament sitting data for a given date range (inclusive of both start and end) into the SQLite database at `data/parliament.db`.

#### Usage
```bash
uv run batch_process_sqlite.py START_DATE [END_DATE]
```

#### Examples
```bash
# Single date
uv run batch_process_sqlite.py 14-01-2026

# Range of dates
uv run batch_process_sqlite.py 12-01-2026 14-01-2026
```

### `generate_summaries_sqlite.py`

Generates AI summaries for sitting sections and MP profiles using Gemini. The `--only-blank` flag generates summaries only for entries that don't have one yet.

#### Usage
```bash
# For sittings
uv run generate_summaries_sqlite.py --sittings START_DATE [END_DATE] [--only-blank]

# For MPs
uv run generate_summaries_sqlite.py --members [--only-blank]
```

#### Examples
```bash
# Range of dates
uv run generate_summaries_sqlite.py --sittings 12-01-2026 14-01-2026

# MPs (based on last 20 contributions)
uv run generate_summaries_sqlite.py --members

# Only fill in missing summaries
uv run generate_summaries_sqlite.py --sittings 12-01-2026 --only-blank
```


## Supporting Modules

| File | Description |
|------|-------------|
| `db_sqlite.py` | Database connection and CRUD operations for SQLite |
| `hansard_api.py` | Client for fetching data from the Hansard API |
| `parliament_sitting.py` | Parsing and structuring of sitting data |
| `prompts.py` | Prompt templates for AI summary generation |
| `util.py` | Shared utility functions |
