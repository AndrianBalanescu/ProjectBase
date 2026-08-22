.PHONY: start dev test docker-build docker-up clean

start:
	./scripts/start.sh

dev:
	./pocketbase serve --dir ./pb_data --publicDir ./pb_public --hooksDir ./pb_hooks --http 0.0.0.0:8120 --dev

test:
	python3 -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8120/api/projectbase/health').read().decode())"

mcp:
	uv run ./scripts/mcp_server.py

docker-build:
	docker build -t projectbase:latest .

docker-up:
	docker compose up -d

clean:
	rm -rf pb_data
