SHELL := /bin/sh

PROJECT_NAME := rankcatalyst
COMPOSE := docker compose

# --- Docker lifecycle ---
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

# --- Backend management ---
migrate:
	$(COMPOSE) exec backend python manage.py migrate

makemigrations:
	$(COMPOSE) exec backend python manage.py makemigrations

superuser:
	$(COMPOSE) exec -it backend python manage.py createsuperuser

shell:
	$(COMPOSE) exec backend python manage.py shell

# --- Tests ---
test-back:
	$(COMPOSE) exec backend pytest -q

test-front:
	$(COMPOSE) exec frontend npm test -- --watch=false

# --- Lint/Format ---
fmt-back:
	$(COMPOSE) exec backend black . && $(COMPOSE) exec backend isort .

lint-back:
	$(COMPOSE) exec backend ruff check . && $(COMPOSE) exec backend mypy .

lint-front:
	$(COMPOSE) exec frontend npm run lint && $(COMPOSE) exec frontend npm run typecheck

# --- DB ---
psql:
	$(COMPOSE) exec db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

# --- Helpers ---
restart-backend:
	$(COMPOSE) restart backend

restart-frontend:
	$(COMPOSE) restart frontend
