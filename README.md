# 🚀 ChaiLM - Production Multi-Modal RAG & Studio Backend Engine

**ChaiLM** is an enterprise-grade, autonomous Retrieval-Augmented Generation (RAG) and Studio Knowledge Synthesis backend. It ingests, vectorizes, and synthesizes multi-modal knowledge sources—including **PDF Documents**, **YouTube Video Lectures**, and **Web Pages**—using hybrid vector retrieval, Reciprocal Rank Fusion (RRF), cross-encoder reranking, and background workflow orchestration via **Inngest**.

---

## 🏗️ System Architecture & Data Flow

```
                               ┌────────────────────────────────────────────────────────┐
                               │               Multi-Modal Ingestion Pipeline           │
                               │        (PDFs, YouTube Transcripts, Web Articles)       │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                            ┌──────────────────────────────┼──────────────────────────────┐
                            │                              │                              │
                    [YouTube Loader]                 [PDF Upload]                   [Web Loader]
                  (Transcript API chunks         (Multer disk storage →         (Firecrawl / Cheerio
                 with startSecs timestamps)     Cloudinary secure hosting)         clean markdown)
                            │                              │                              │
                            └──────────────────────────────┼──────────────────────────────┘
                                                           │
                                             ┌─────────────┴─────────────┐
                                             │  Inngest Event Bus Queue  │
                                             │  (Async Background Worker) │
                                             └─────────────┬─────────────┘
                                                           │
                                          ┌────────────────┴────────────────┐
                                          │                                 │
                             Vectorize & Chunking                Hierarchical Outline Extractor
                            (text-embedding-3-small)             (Chunk-level thematic summaries)
                                          │                                 │
                               ┌──────────┴──────────┐            ┌─────────┴─────────┐
                               │  Qdrant Vector DB   │            │   MongoDB Atlas   │
                               │  (Workspace Scoped) │            │ (Artifacts/Store) │
                               └──────────┬──────────┘            └───────────────────┘
                                          │
 ┌────────────────────────────────────────┴───────────────────────────────────────────────────────┐
 │                                   6-Stage RAG Query Pipeline                                    │
 └────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │                                                 │
      Multi-Angle Query Translation                      HyDE Document Generator
  (Rewrite, Step-Back, 3–5 Sub-Queries)              (Hypothetical Answer Embedding)
                 │                                                 │
                 └────────────────────────┬────────────────────────┘
                                          │
                           Parallel Scoped Vector Search
                        (Qdrant DB Filter: workspaceId)
                                          │
                             Reciprocal Rank Fusion (RRF)
                                          │
                            Cohere Rerank v3.5 Cross-Encoder
                                          │
                            Modular Context Formatters
                          (PDF, YouTube, Web formatters)
                                          │
                         Structured LLM Synthesis & Citations
                      (GPT-4o-mini + Strict Zod Response Format)
```

---

## ✨ Key Backend Features

### 1. Multi-Modal Ingestion & Vectorization
- **PDF Documents**: Uploaded via **Multer**, permanently mirrored to **Cloudinary** (`chaiLM` folder), parsed via `pdf-parse`, chunked with `RecursiveCharacterTextSplitter` (600 tokens, 150 overlap), and indexed with exact `pageNumber` metadata.
- **YouTube Video Lectures**: Fetched via `transcriptapi.com`, grouped into character-bounded chunks preserving exact video start timestamps (`startSeconds`), allowing deep-link citations (`00:14:22`).
- **Web Pages**: Scraped into clean markdown via **Firecrawl** / `CheerioWebBaseLoader` with semantic section parsing.

### 2. Autonomous Asynchronous Workflows (Inngest)
- **`inngest/indexDocument`**: Handles background document parsing, chunking, Cloudinary upload, and Qdrant indexing without blocking HTTP request threads.
- **`inngest/extractStudioOutline`**: Extracts thematic chapters, key takeaways, and outline segments upon ingestion for instant Studio synthesis.

### 3. 6-Stage Retrieval & Synthesis Pipeline
1. **Multi-Angle Query Translation**: Generates rewritten queries, step-back conceptual questions, and 3–5 granular sub-queries using OpenAI structured outputs.
2. **Cross-Lingual Phonetic Expansion**: Automatically synthesizes native Devanagari script transliterations for Hindi/Hinglish videos (e.g., "Claude" → "क्लॉड", "Agents" → "एजेंट्स").
3. **HyDE (Hypothetical Document Embeddings)**: Generates a plausible hypothetical reference passage to maximize semantic vector recall.
4. **Scoped Parallel Search**: Executes filtered vector similarity search against Qdrant restricted strictly to active `workspaceId` and `selectedSourceIds`.
5. **Reciprocal Rank Fusion (RRF)**: Merges ranked candidate lists from all search queries into a single unified candidate pool.
6. **Cohere Rerank v3.5 Cross-Encoder**: Evaluates true token-level semantic relevance, returning the top 5 most grounded context chunks.
7. **Structured Synthesis**: Outputs executive summaries, segmented breakdowns, and clickable citations (`[00:14:22]`, `[Page 12]`, `[Web Source]`).

### 4. Studio Artifact Generation Engine (5 AI Study Modalities)
- 📘 **Study Guide**: Synthesizes chapter modules, key takeaways, and domain glossaries.
- 🗂️ **Flashcard Deck**: Generates active recall cards with hints, difficulty ratings, and source citations.
- 💡 **Assessment Quiz**: Creates interactive multiple-choice tests with comprehensive rationale explanations.
- 🧠 **Hierarchical Mind Map**: Generates multi-level conceptual trees mapping all source concepts.
- 🎙️ **Audio Overview**: Produces two-host conversational podcast dialogues with simulated audio stream playback.

### 5. Multi-User Workspace Architecture
- **JWT Authentication**: Secure HTTP-only cookies with bcrypt password hashing.
- **Isolated Workspaces**: Granular user-owned workspaces with isolated document collections and persistent chat histories in **MongoDB**.

---

## 📁 Repository Structure

```
chaiLM/server/
├── .github/
│   └── workflows/
│       ├── ci.yml                   # CI pipeline: Docker build validation on PRs
│       └── publish.yml              # CD pipeline: GHCR image push & Cloud Run deploy
├── public/
│   └── temp/                        # Temporary buffer for Multer file uploads
├── src/
│   ├── config/
│   │   ├── env.js                   # Centralized environment variables
│   │   ├── qdrant.js                # Qdrant Vector DB client configuration
│   │   └── ai.js                    # OpenAI SDK client configuration
│   ├── controllers/
│   │   ├── health.controller.js     # Health check endpoint controller
│   │   ├── indexer.controller.js    # Document ingestion controller
│   │   ├── query.controller.js      # RAG query & synthesis controller
│   │   ├── studio.controller.js     # Studio artifact generator controller
│   │   ├── user.controller.js       # Authentication & user profile controller
│   │   └── workspace.controller.js  # Workspace CRUD controller
│   ├── db/
│   │   └── index.js                 # MongoDB connection handler
│   ├── inngest/
│   │   ├── client.js                # Inngest client initialization
│   │   └── functions/
│   │       ├── indexDocument.function.js        # Background document indexer
│   │       └── extractStudioOutline.function.js # Background outline extractor
│   ├── lib/
│   │   └── qdrant.lib.js            # Qdrant helper client
│   ├── loaders/
│   │   ├── pdf.loader.js            # PDF parser & metadata extractor
│   │   ├── youtube.loader.js        # YouTube transcript loader with timestamps
│   │   └── web.loader.js            # Web page loader (Firecrawl/Cheerio)
│   ├── middlewares/
│   │   ├── auth.middleware.js       # JWT cookie authentication middleware
│   │   └── multer.middlewares.js    # Multer disk storage & PDF validation
│   ├── models/
│   │   ├── user.model.js            # User mongoose schema
│   │   ├── Workspace.model.js       # Workspace mongoose schema
│   │   ├── ChatMessage.model.js     # Chat history mongoose schema
│   │   └── StudioArtifact.model.js  # Studio generated artifacts schema
│   ├── prompt/
│   │   ├── formatters/              # Modular prompt context formatters
│   │   │   ├── pdf.formatter.js
│   │   │   ├── youtube.formatter.js
│   │   │   ├── web.formatter.js
│   │   │   └── index.js
│   │   ├── buildPrompt.js           # Prompt builder
│   │   ├── systemPrompt.js          # System instructions & citation rules
│   │   └── vectorFormatter.js       # Context dispatcher
│   ├── routes/
│   │   ├── health.routes.js         # /api/health
│   │   ├── indexer.routes.js        # /api/indexer
│   │   ├── inngest.routes.js        # /api/inngest
│   │   ├── query.routes.js          # /api/query
│   │   ├── studio.routes.js         # /api/studio
│   │   ├── user.routes.js           # /api/user & /api/auth
│   │   └── workspace.routes.js      # /api/workspace
│   ├── services/
│   │   ├── indexer.service.js       # Document processing & vector ingestion
│   │   ├── query.service.js         # End-to-end RAG query orchestrator
│   │   ├── studioUnitLoader.service.js # Studio context builder
│   │   └── ai/
│   │       ├── answerSynthesizer.service.js # Structured LLM answer synthesis
│   │       ├── hyde.service.js              # HyDE hypothetical passage generator
│   │       ├── outlineExtractor.service.js  # Thematic outline extractor
│   │       ├── outlineMerge.service.js      # Outline chunk merger
│   │       ├── reranker.service.js          # Cohere Rerank v3.5
│   │       ├── translateQuery.service.js    # Multi-angle query expansion
│   │       └── artifact/                    # 5 Studio Artifact Generators
│   │           ├── studyGuide.generator.js
│   │           ├── flashcards.generator.js
│   │           ├── quiz.generator.js
│   │           ├── mindmap.generator.js
│   │           ├── audioOverview.generator.js
│   │           └── artifactGenerator.service.js
│   ├── utils/
│   │   ├── Cloudinary.utils.js      # Cloudinary upload & temp cleanup
│   │   ├── responseSchema.utils.js  # Zod schemas for structured outputs
│   │   └── rrf.js                   # Reciprocal Rank Fusion algorithm
│   └── app.js                       # Express app configuration & middleware
├── .dockerignore                    # Docker build ignore rules
├── .env.example                     # Reference environment variables
├── Dockerfile                       # Multi-stage Node.js 22 alpine container
├── docker-compose.yml               # Multi-container orchestration (API + Qdrant + Inngest)
├── package.json                     # Dependencies & scripts
└── server.js                        # HTTP server entry point
```

---

## 🔐 Environment Variables (`.env`)

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (MongoDB)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/chailm?retryWrites=true&w=majority

# Vector Database (Qdrant)
QDRANT_URL=http://127.0.0.1:6333
# For Qdrant Cloud: QDRANT_URL=https://<your-cluster-id>.us-east-1-0.aws.cloud.qdrant.io:6333
# QDRANT_API_KEY=your_qdrant_cloud_api_key
QDRANT_COLLECTION=workspace-docs

# AI Services
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# Cohere Reranker
COHERE_API_KEY=your_cohere_api_key

# Web Scraping & Transcripts
FIRECRAWL_API_KEY=fc-...
TRANSCRIPT_API_KEY=your_transcript_api_key

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Authentication
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Text Chunking Settings
CHUNK_SIZE=600
CHUNK_OVERLAP=150
```

---

## ⚡ Local Development Setup

### Option 1: Docker Compose (Full Stack - Recommended)
Runs the API, local Qdrant vector database, and local Inngest dev server together:
```bash
docker compose up -d
```
- **API Server**: `http://localhost:5000`
- **Qdrant Dashboard**: `http://localhost:6333/dashboard`
- **Inngest Dev Server**: `http://localhost:8288`

---

### Option 2: Standard Node.js Workflow

1. **Start Qdrant Vector DB**:
   ```bash
   docker compose up -d qdrant
   ```

2. **Install Dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start Inngest Dev Server** (Terminal 1):
   ```bash
   npx inngest-cli@latest dev -u http://localhost:5000/api/inngest
   ```

4. **Start Development Server** (Terminal 2):
   ```bash
   npm run dev
   ```

---

## 📡 Complete API Reference

### 1. Authentication (`/api/user`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/user/register` | Register a new user | No |
| `POST` | `/api/user/login` | Login user & set HTTP-only cookie | No |
| `POST` | `/api/user/logout` | Clear auth cookie | Yes |
| `GET` | `/api/user/me` | Get current authenticated user | Yes |

### 2. Workspaces (`/api/workspace`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/workspace` | List all user workspaces | Yes |
| `POST` | `/api/workspace` | Create a new workspace | Yes |
| `GET` | `/api/workspace/:id` | Get full workspace (sources, history) | Yes |
| `DELETE` | `/api/workspace/:id` | Delete workspace and all vectors | Yes |

### 3. Document Indexing (`/api/indexer`)
| Method | Endpoint | Payload | Description |
|---|---|---|---|
| `POST` | `/api/indexer` | `multipart/form-data` with `file`, `type=pdf`, `workspaceId` | Ingest and vectorize PDF |
| `POST` | `/api/indexer` | `application/json` with `url`, `type=youtube`, `workspaceId` | Ingest YouTube transcript |
| `POST` | `/api/indexer` | `application/json` with `url`, `type=website`, `workspaceId` | Ingest Web URL with Firecrawl |

### 4. Grounded RAG Query (`/api/query`)
| Method | Endpoint | Payload | Description |
|---|---|---|---|
| `POST` | `/api/query` | `{ query, workspaceId, selectedSourceIds? }` | Run 6-stage RAG retrieval & structured synthesis |

### 5. Studio Artifacts (`/api/studio`)
| Method | Endpoint | Payload / Params | Description |
|---|---|---|---|
| `POST` | `/api/studio/study-guide` | `{ workspaceId, sourceId?, title?, userPrompt? }` | Generate structured study guide |
| `POST` | `/api/studio/flashcards` | `{ workspaceId, sourceId?, cardCount?, difficulty? }` | Generate flashcard deck |
| `POST` | `/api/studio/quiz` | `{ workspaceId, sourceId?, questionCount?, difficulty? }` | Generate assessment quiz |
| `POST` | `/api/studio/mindmap` | `{ workspaceId, sourceId? }` | Generate hierarchical mind map |
| `POST` | `/api/studio/audio-overview`| `{ workspaceId, sourceId? }` | Generate 2-host audio podcast script |
| `GET` | `/api/studio/workspace/:id` | Workspace ID param | Get all generated artifacts for workspace |
| `DELETE`| `/api/studio/:artifactId` | Artifact ID param | Delete a specific artifact |

### 6. Health Check (`/api/health`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns server status, uptime, and database connectivity |

---

## 🚢 CI/CD & Production Deployment (Google Cloud Run via GHCR)

The **ChaiLM API** is containerized with **Docker (Node.js 22 Alpine)**, automatically built and published to **GitHub Container Registry (GHCR)**, and deployed directly to **Google Cloud Run** in `asia-south1` via **Workload Identity Federation**.

### 1. Dockerfile (`Dockerfile`)

```dockerfile
FROM node:22-alpine

WORKDIR /usr/src/api

COPY package*.json .npmrc ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

---

### 2. CI Workflow (`.github/workflows/ci.yml`)
Runs validation builds on Pull Requests to `dev` and `main`:
- Checks out code with `actions/checkout@v4`
- Builds the Docker image without pushing using `docker/build-push-action@v6` to ensure container build integrity.

---

### 3. CD Pipeline (`.github/workflows/publish.yml`)

Triggers on push to `dev` or `main`:

1. **Build & Publish Image to GHCR**:
   - Authenticates to `ghcr.io` via `GITHUB_TOKEN`.
   - Tags the image based on branch (`:latest` on `main`, `:dev` on `dev`, plus git commit SHA tag `:${{ github.sha }}`).
   - Pushes the image: `ghcr.io/adii4040/chailm-api:<tag>`.

2. **Deploy to Google Cloud Run** (on `main` branch):
   - Authenticates to GCP using **Workload Identity Federation** (Keyless / Zero-Secret auth):
     - **Project ID**: `chailm-507011`
     - **Workload Identity Provider**: `projects/756784338813/locations/global/workloadIdentityPools/github-actions/providers/github`
     - **Service Account**: `github-deployer@chailm-507011.iam.gserviceaccount.com`
   - Deploys revision to **Google Cloud Run**:
     - **Service**: `chailm-api`
     - **Region**: `asia-south1`
     - **Image**: `ghcr.io/adii4040/chailm-api:${{ github.sha }}`

---

### 4. Sync Inngest Webhook with Live Cloud Run Service
Once deployed, register the live Google Cloud Run endpoint with Inngest Cloud:
```
https://<chailm-api-url>.a.run.app/api/inngest
```

---

## 🛡️ License

ISC License © 2026 ChaiLM. 
