# Installation

## Prerequisites

- [Bun](https://bun.sh/) — used as the package manager and runtime for this project.

## Install dependencies

```bash
bun install
```

## Configure environment variables

Copy the example env file `.env.exemple` to `.env` and fill in the values:

```bash
cp .env.exemple .env
```

- `VITE_PUBLIC_NODES_API_KEY`: a node API key, available at [nanswap.com/nodes](https://nanswap.com/nodes).

## Run the web version (dev)

```bash
bun run dev
```
