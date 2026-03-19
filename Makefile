.PHONY: dev dev-log build start stop restart lint clean clean-all \
       setup install \
       migrate seed reset studio db-push db-generate \
       logs typecheck

# ─── Development ──────────────────────────────────────────
dev:
	npx next dev --turbopack -p 3000

dev-log:
	npx next dev --turbopack -p 3000 2>&1 | tee /tmp/next-dev.log

build:
	npx next build

start:
	npx next start -p 3000

lint:
	npx eslint .

typecheck:
	npx tsc --noEmit

stop:
	@pkill -f "next dev" 2>/dev/null && echo "✓ Dev server stopped." || echo "No dev server running."
	@pkill -f "claude-auth-pty" 2>/dev/null; true
	@pkill -f "claude auth login" 2>/dev/null; true

restart: stop
	@sleep 1
	@$(MAKE) dev

# ─── Setup ────────────────────────────────────────────────
install:
	npm install

setup: install db-generate migrate seed
	@echo "✓ Setup complete. Run 'make dev' to start."

# ─── Database ─────────────────────────────────────────────
migrate:
	npx prisma migrate dev

db-push:
	npx prisma db push

seed:
	npx tsx prisma/seed.ts

reset:
	npx prisma migrate reset --force

studio:
	npx prisma studio

db-generate:
	npx prisma generate

# ─── Logs ─────────────────────────────────────────────────
logs:
	@tail -f /tmp/next-dev.log 2>/dev/null || echo "No log file. Run 'make dev-log' first."

# ─── Cleanup ──────────────────────────────────────────────
clean:
	rm -rf .next node_modules/.cache

clean-all:
	rm -rf .next node_modules prisma/dev.db
	@echo "Run 'make setup' to reinstall."
