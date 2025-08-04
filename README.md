# Monument Data Migration

&#x20;

A NestJS-powered CLI utility for migrating self-storage data from flat-file CSV exports into a PostgreSQL database. Designed for reliability and repeatability, it ingests `unit.csv` and `rentRoll.csv`, validates and transforms the data, and idempotently upserts records—ensuring that re-running the migration after CSV changes reflects updates without creating duplicates.

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
- [Testing](#testing)
- [Error Handling & Retries](#error-handling--retries)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Idempotent Upserts**: Uses natural keys and `ON CONFLICT` logic so you can re-run the migration after CSV edits without duplicating records.
- **CSV Parsing & Normalization**: Handles `unitSize` (e.g., `10x12x8`), dates, phone numbers, and rent values with robust validation and fallback strategies.
- **Transactional Integrity**: Wraps each row’s operations (facility → unit → tenant → contract → invoice) in a database transaction to ensure atomicity.
- **Audit Logging**: Emits detailed logs of created, updated, and rejected rows for troubleshooting and reporting.
- **Docker-Compose Support**: Spin up a local PostgreSQL instance with a single command.
- **Configurable & Extensible**: Environment-driven configuration and modular upsert helpers to adapt to new schemas or data sources.

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
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=monument_migration
DATA_FOLDER_NAME=data
```

### Database Setup (Docker)

Launch a local PostgreSQL container:

```bash
docker-compose up -d
```

This will create a PostgreSQL instance listening on the port configured in your `.env`.

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
npm run migrate
```

On completion, you’ll see a summary of:

- Records created
- Records updated
- Rows rejected (with reasons)

---

## Project Structure

```
monument-data-migration/
├─ src/
│  ├─ entities/           # TypeORM entity definitions
│  ├─ upsert-utils.ts     # Helper functions for idempotent upserts
│  ├─ migration.service.ts # Core migration logic and orchestration
│  └─ main.ts             # CLI bootstrap
├─ data/                  # Place your CSV files here
│  ├─ unit.csv
│  └─ rentRoll.csv
├─ logs/                  # Audit logs and rejection reports
├─ docker-compose.yml     # PostgreSQL service
├─ .env.example           # Sample environment variables
├─ package.json
└─ README.md
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

## Testing

Unit tests cover transformation helpers and upsert logic:

```bash
npm run test
```

---

## Error Handling & Retries

- **Atomicity**: Each row is wrapped in its own transaction. Failures roll back that row’s changes.
- **Rejection Reports**: Malformed or invalid rows are skipped and appended to `logs/rejections.csv` with the error reason.
- **Retry**: Fix the source CSV and re-run `npm run migrate`; only changed rows will be updated/inserted.

---

## Contributing

Contributions welcome! Please fork the repo and open a PR with your changes.\
Ensure new features include relevant tests and update the README as needed.

---

## License

This project is licensed under the [MIT License](LICENSE).
