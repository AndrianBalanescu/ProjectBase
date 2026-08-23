.PHONY: start dev test docker-build docker-up clean

start:
	./scripts/start.sh

dev:
	./pocketbase serve --dir ./app/pb_data --publicDir ./app/pb_public --hooksDir ./app/pb_hooks --migrationsDir ./app/pb_migrations --http 0.0.0.0:8120 --dev

test:
	pytest -v tests/

mcp:
	uv run ./scripts/mcp_server.py

docker-build:
	docker build -t projectbase:latest .

docker-up:
	docker compose up -d

clean:
	rm -rf app/pb_data pb_data
