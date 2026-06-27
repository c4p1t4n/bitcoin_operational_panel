# Bitcoin Ops Panel - Database Infrastructure

This directory contains the database setup for the Bitcoin Operational Panel using PostgreSQL and Drizzle ORM.

## Quick Start

### Start PostgreSQL Container

```bash
cd app/infra
docker-compose up -d
```

The database will be available at `localhost:5432` with:
- Database: `bitcoin_ops`
- User: `ops_user`
- Password: (set via `DB_PASSWORD` env var, defaults to `ops_password_dev`)

### Generate Drizzle Migrations

First, ensure your backend has Drizzle CLI installed and configured.

```bash
# From the app/backend directory
npm run drizzle:generate
npm run drizzle:migrate
```

## Schema Overview

### Tables

- **users**: Application users with roles (ADMIN, VIEWER, OPERATOR)
- **events**: Immutable append-only event log following event sourcing pattern
- **alerts**: Alert records with status and severity tracking
- **operations_log**: User-friendly view of important events for UI timeline
- **peers_status**: Bitcoin network peer connectivity tracking
- **rule_definitions**: Configurable alert rules (fees, transactions, blocks)

### Event Sourcing Pattern

Events are stored immutably with versioning per aggregate:
- `aggregate_id`: Identifier of the entity (block hash, alert UUID, peer address)
- `aggregate_type`: Entity type (Block, Transaction, Alert, Peer)
- `event_type`: Domain event (NewBlockMined, PeerConnected, AlertAcknowledged)
- `version`: Monotonic version for optimistic locking
- `payload`: Event-specific data in JSON
- `metadata`: System metadata (user, traceId, ip)

### Example Event Stream

```
Block 0000000...abc
├── v1: NewBlockMined
└── v2: BlockReorganized

Alert uuid-1234-5678
├── v1: AlertCreated
└── v2: AlertAcknowledged
```

## Drizzle Schema File

The `schema.ts` file defines all tables, columns, indexes, and relationships using Drizzle ORM.

Key features:
- Type-safe queries
- Automatic migration generation
- Relationship definitions for JOINs
- Index optimization for common queries

## Environment Variables

Create a `.env` file in this directory:

```bash
cp .env.example .env
```

Available variables:
- `DB_PASSWORD`: PostgreSQL password
- `DATABASE_URL`: Full connection string (auto-generated from other vars)

## Stop Container

```bash
docker-compose down
```

## Reset Database (Development Only)

```bash
docker-compose down -v
docker-compose up -d
```

This removes the volume and recreates a fresh database.
