# Monument Data Migration

&#x20;

A NestJS-powered CLI utility for migrating self-storage data from flat-file CSV exports into a PostgreSQL database. Designed for reliability and repeatability, it ingests `unit.csv` and `rentRoll.csv`, validates and transforms the data, and aim to idempotently upserts records—ensuring that re-running the migration after CSV changes reflects updates without creating duplicates.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Clone the Repository](#clone-the-repository)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup (Docker)](#database-setup-docker)
  - [Install Dependencies](#install-dependencies)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Data Files](#data-files)
- [Logging & Audit](#logging--audit)
- [Testing (TODO)](#testing-todo)
- [Error Handling & Retries](#error-handling--retries)
- [Next](#next)

---

## Features

- **Idempotent Upserts**: Uses natural keys and `ON CONFLICT` logic so you can re-run the migration after CSV edits without duplicating records.
- **CSV Parsing & Normalization**: Handles `unitSize` (e.g., `10x12x8`), with robust validation and fallback strategies. TODO: Add the same logic for dates, phone numbers, and rent values.
- **Transactional Integrity**: Wraps each row’s operations (facility → unit → tenant → contract → invoice) in a database transaction to ensure atomicity.
- **Audit Logging**: Emits detailed logs of created, updated, and rejected rows for troubleshooting and reporting.
- **Docker-Compose Support**: Spin up a local PostgreSQL instance with a single command.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

---

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/tairoteixeira2020/monument-data-migration.git
cd monument-data-migration
```

### Environment Configuration

Copy the example `.env.example` to `.env` and adjust values as needed:

```
# .env
DB_HOST=localhost                # Hostname of the PostgreSQL server
DB_PORT=5437                     # Custom Postgres port (default is 5432)
DB_USER=monument                 # Database username for migration
DB_PASS=monument123              # Password for the 'monument' database user
DB_NAME=monument                 # Target PostgreSQL database name

PORT=3000                        # HTTP port for the NestJS application (if used)

DATA_FOLDER_NAME=client1_health  # Subdirectory in /data where CSV files reside
```

### Database Setup (Docker)

Launch a local PostgreSQL container:

```bash
docker-compose up -d
```

This will create a PostgreSQL instance listening on the port configured in your `docker-compose.yml`.

When you run the command below and rerun the docker-compose up -d a fresh new PostgreSQL container is created.

```bash
docker compose down
```

### Install Dependencies

```bash
npm install
# or
# yarn install
```

---

## Usage

Run the migration pipeline with:

```bash
npm run migrate:all
```

On completion, you’ll see a summary of:

- Records created
- Records updated
- Rows rejected (with reasons)

---

## Project Structure

```
monument-data-migration/
├── data                      # CSV input folders
├── logs                      # Migration error logs
├── src                       # Application source code
│   ├── entities              # TypeORM entity definitions
│   │   ├── facility.entity.ts
│   │   ├── rental-contract.entity.ts
│   │   ├── rental-invoice.entity.ts
│   │   ├── tenant.entity.ts
│   │   └── unit.entity.ts
│   ├── main.ts               # CLI bootstrap
│   ├── migration             # Migration feature module
│   │   ├── migration.command.ts
│   │   ├── migration.module.ts
│   │   └── migration.service.ts
│   ├── scripts               # Standalone scripts
│   │   └── run-migration.ts
│   └── transformers          # Data transformation utilities
│       └── iso-date.transformer.ts
├── docker-compose.yml        # PostgreSQL service configuration
├── package.json
├── package-lock.json
└── README.md
```

---

## Configuration

| Variable           | Description                 | Default              |
| ------------------ | --------------------------- | -------------------- |
| `DB_HOST`          | PostgreSQL host             | `localhost`          |
| `DB_PORT`          | PostgreSQL port             | `5432`               |
| `DB_USER`          | Database user               | `postgres`           |
| `DB_PASSWORD`      | Database password           | `postgres`           |
| `DB_NAME`          | Database name               | `monument_migration` |
| `DATA_FOLDER_NAME` | Relative path to CSV folder | `data`               |

---

## Data Files

Place your source CSVs in the `data/` directory at the project root:

- ``: Contains facility names, unit numbers, dimensions (WxLxH), types, and base rents.
- ``: Contains tenant information, rental start/end dates, monthly rents, and current amounts owed.

Columns are validated and transformed automatically; invalid rows are logged to `logs/rejections.csv`.

---

## Logging & Audit

- **Console**: Summary of operations (counts of upserts, updates, rejections).
- **File Logs**: Detailed CSV report of rejected rows (in `logs/rejections.csv`) with reasons.
- **Debug Mode**: Use `DEBUG=true npm run migrate` for additional trace logs.

---

## Testing (TODO)

Unit tests should cover transformation helpers and upsert logic:

```bash
npm run test
```

---

## Error Handling & Retries

- **Atomicity**: Each row is wrapped in its own transaction. Failures roll back that row’s changes.
- **Rejection Reports**: Malformed or invalid rows are skipped and appended to `logs/rejections.csv` with the error reason.
- **Retry**: Fix the source CSV and re-run `npm run migrate`; only changed rows will be updated/inserted.

## Next
- **Phone/string normalization**: format phone numbers (e.g. removing non-digits or enforcing a pattern).
- **Scalability**: 
  - ***Batching & batched commits***: group operations into batches of N rows. Send each batch of inserts/updates together and then commit rather than executing and committing one row at a time.
  - ***Stream processing***: read big csv files using fs stream `fs.createReadStream(filePath)`.