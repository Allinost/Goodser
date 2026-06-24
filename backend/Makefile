.PHONY: base build up down logs

# Build the pre-cached base image (one-time, ~40s but cached forever)
base:
	@echo "Building base image with system dependencies..."
	docker build -f Dockerfile.base -t goodser-dev-base .
	@echo "Base image built: goodser-dev-base"

# Build the backend application image
build:
	docker compose -f ../docker-compose.yml build backend

# Start all services
up:
	docker compose -f ../docker-compose.yml up -d

# Stop all services
down:
	docker compose -f ../docker-compose.yml down

# View backend logs
logs:
	docker compose -f ../docker-compose.yml logs -f backend

# Full setup: build base, then build backend, then start
setup: base build up
	@echo "Setup complete!"
