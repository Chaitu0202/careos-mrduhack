.PHONY: help install dev build verify docker-up docker-down db-validate db-migrate analytics-test

help:
	@echo "CareOS production targets"
	@echo "  install       Install JavaScript dependencies with Bun"
	@echo "  dev           Start local preview on :3000"
	@echo "  build         Build static frontend into dist/"
	@echo "  verify        Run typecheck, DB validation, analytics checks and tests"
	@echo "  docker-up     Start api + frontend + analytics containers"
	@echo "  docker-down   Stop containers"
	@echo "  db-validate   Validate the JSON database"
	@echo "  db-migrate    Export JSON database to PostgreSQL seed SQL"
	@echo "  analytics-test Run Python analytics unit tests"

install:
	bun install

dev:
	bun run dev

build:
	bun run build

verify:
	bun run check

docker-up:
	docker compose -f infra/docker-compose.yml up --build -d

docker-down:
	docker compose -f infra/docker-compose.yml down

db-validate:
	bun run db:validate

db-migrate:
	bun run db:migrate

analytics-test:
	bun run analytics:test
