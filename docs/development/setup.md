# Development Setup

This document defines the intended setup once implementation begins.

## Prerequisites

- Python
- Node.js
- npm
- Docker and Docker Compose
- Git

## Infrastructure

Start:
- PostgreSQL + pgvector
- Redis
- MinIO

Then run:
- Django API
- Celery worker
- React/Vite

## Environment variables

Maintain `.env.example` containing placeholders for:
- Django secret key
- database URL/credentials
- Redis URL
- Gemini API key
- S3 endpoint/bucket/access credentials
- email provider credentials
- frontend URL
- JWT settings

Never commit real secrets.
