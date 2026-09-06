# Libraries and Services

## Backend

| Library/technology | Purpose |
|---|---|
| Django | Web framework and ORM |
| Django REST Framework | REST API |
| Simple JWT | JWT authentication |
| drf-spectacular | OpenAPI 3 schema + Swagger/ReDoc |
| PostgreSQL | Relational database |
| pgvector | Vector similarity search |
| psycopg | PostgreSQL driver |
| Celery | Background task processing |
| RabbitMQ | Celery task/message broker |
| Redis | Cache and short-lived application state |
| boto3 / S3 SDK | S3-compatible object storage integration |
| Django Debug Toolbar | Development diagnostics |
| Python logging | Application logging |
| Gemini SDK/API client | LLM/embedding integration as selected |

## Frontend

| Library/technology | Purpose |
|---|---|
| React | UI |
| Vite | Frontend build/dev server |
| JavaScript | Application language |
| Tailwind CSS | Styling |
| shadcn/ui | Accessible reusable UI components |
| React Router | Routing |
| TanStack Query | Server state |
| Axios or fetch abstraction | HTTP communication |

## Infrastructure

| Service | Purpose |
|---|---|
| PostgreSQL + pgvector | Primary database and vector retrieval |
| Redis | Cache/broker |
| MinIO | Local S3-compatible storage |
| AWS S3 | Production object storage |
| Celery worker | Async processing |

## Selection rule

Do not add a library simply because it is popular. Each dependency should have an identified architectural purpose and should be pinned/controlled through the project's dependency management files when implementation begins.
