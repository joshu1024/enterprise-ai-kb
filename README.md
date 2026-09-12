# 🧠 Enterprise AI Knowledge Base

A production-ready multi-tenant RAG SaaS that lets teams upload company documents and query them in natural language. Built as part of a fullstack AI engineer learning roadmap.

![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6)
![Node](https://img.shields.io/badge/Backend-Node.js-green)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL+pgvector-336791)
![Cohere](https://img.shields.io/badge/Embeddings-Cohere-purple)
![Groq](https://img.shields.io/badge/LLM-Groq-orange)

---

## 🌐 Live Demo

- 🖥️ **Frontend (Vercel)** → coming soon
- ⚙️ **Backend (Render)** → coming soon

---

## 🤖 AI Features

### ✅ Completed

| Feature | Description | Tech |
|---------|-------------|------|
| Document ingestion | Upload PDF, DOCX, TXT, HTML — parsed, chunked, embedded, stored | pdf-parse, mammoth, cheerio, Cohere |
| Recursive chunking | Splits on paragraphs → sentences → words. Preserves semantic boundaries | Custom implementation |
| Vector storage | 1024-dim Cohere embeddings stored in PostgreSQL with HNSW index | pgvector + Neon |
| HyDE retrieval | Generates hypothetical answer first, embeds that instead of raw query | Groq + Cohere |
| Hybrid search | Vector cosine similarity + BM25 keyword search fused with RRF | pgvector + PostgreSQL FTS |
| Re-ranking | LLM scores top 10 retrieved chunks, returns best 5 | Groq |
| Source citations | Every answer includes which document chunks it came from | Custom |
| Streaming answers | Word-by-word SSE streaming via raw fetch (bypasses SDK limitations) | Groq + SSE |
| Semantic caching | Near-identical queries (>0.92 similarity) served from cache — zero API cost | pgvector |
| Multi-tenant auth | Organizations, JWT, role-based access (admin/member) | bcryptjs + JWT |
| AI security layer | Rate limiting, prompt injection detection, per-user token quota | express-rate-limit |
| RAG evaluation | RAGAS-style faithfulness, relevance, context recall scoring | Groq as judge |
| Admin stats | Token usage, estimated cost, per-user breakdown | Prisma aggregation |
| Unit tests | 19 tests — chunking, citations, injection detection, embedding parsing | Vitest |

### 🔜 Coming Soon

| Feature | Description |
|---------|-------------|
| Frontend UI | React + TypeScript + shadcn/ui — chat, document library, admin panel |
| Document status polling | Live status updates as documents are processed |
| Docker + CI/CD | Containerization and GitHub Actions pipeline |

---

## 🏗️ Architecture

User query
↓
HyDE — generate hypothetical answer → embed it
↓
Hybrid search — vector (pgvector) + keyword (BM25) → RRF fusion
↓
Re-ranking — LLM scores top 10 → returns best 5
↓
Context injection → streaming answer with [Source N] citations
↓
Semantic cache write (background)


### Why this pipeline beats basic RAG

| Basic RAG | This implementation |
|-----------|---------------------|
| Embed raw query | Embed hypothetical answer (HyDE) |
| Vector search only | Vector + keyword hybrid search |
| Return top-k directly | Re-rank with LLM cross-encoder |
| No caching | Semantic cache at 0.92 threshold |
| Generic retrieval | Org-scoped — users only access their own docs |

---

## 💡 Architectural Decisions

| Decision | Why |
|----------|-----|
| pgvector over Pinecone | Already on PostgreSQL — no new service, no extra cost. Handles current scale with HNSW indexing |
| Cohere over OpenAI for embeddings | Free tier (1000 calls/month), no credit card, 1024-dim vectors |
| Groq over OpenAI for LLM | Free tier, fast inference |
| Raw fetch over Groq SDK | SDK v1.5.0 couldn't parse reasoning model streaming chunks — raw SSE reading is more explicit and reliable |
| Recursive chunking | Preserves paragraph and sentence boundaries better than fixed-size. Splits on `\n\n` → `\n` → `. ` → ` ` |
| Background ingestion | Upload response is instant — chunking and embedding run async. User gets immediate feedback |
| Semantic caching | Repeated questions cost zero API calls. 0.92 similarity threshold balances cache hits vs answer freshness |
| Multi-tenant by org | Every query, document, and cache entry is scoped by `organizationId` — data isolation by design |

---

## 🗺️ RAG Pipeline Detail

**Step 1 — HyDE (Hypothetical Document Embeddings)**
Instead of embedding the raw user question, the LLM generates a fake answer first. That fake answer is embedded and used for retrieval. Questions and answers live in different vector spaces — embedding a fake answer gets you closer to the actual document chunks.

**Step 2 — Hybrid Search**
Two searches run in parallel:
- Vector search: cosine similarity via pgvector `<=>` operator
- Keyword search: PostgreSQL `to_tsvector` + `plainto_tsquery` (BM25-style)

Results are merged with Reciprocal Rank Fusion (RRF): `score = Σ 1/(k + rank)` where k=60.

**Step 3 — Re-ranking**
The top 10 hybrid results are scored by the LLM on relevance to the original query. This cross-encoder approach catches nuance that neither vector nor keyword search can.

**Step 4 — Context injection + streaming**
Top 5 re-ranked chunks are injected into the system prompt. The LLM is instructed to cite sources inline as `[Source N]`. Answer streams word by word via SSE.

**Step 5 — Semantic caching**
The full answer and citations are embedded and stored. Next time a similar question arrives (similarity > 0.92), the cache answer is returned immediately.

---

## 🧪 Tests

```bash
npm run test:run
```

✓ recursiveChunk — 4 tests
✓ buildCitations — 3 tests
✓ prompt injection detection — 5 tests
✓ parseEmbedding — 5 tests
✓ vectorString formatting — 2 tests

19 passed


---

## 🧠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js + Express | REST API + SSE streaming |
| TypeScript | Full type safety throughout |
| PostgreSQL + pgvector | Relational data + vector similarity search |
| Prisma ORM | Schema, migrations, typed queries |
| Neon | Serverless PostgreSQL — never suspends |
| Cohere SDK | Text embeddings — embed-english-v3.0 |
| Groq API | LLM inference — fast free tier |
| Multer | File upload handling |
| pdf-parse, mammoth, cheerio | Document parsing |
| express-rate-limit | Rate limiting on AI endpoints |
| bcryptjs + JWT | Auth and password hashing |
| Vitest | Unit testing |

### Frontend (coming soon)
| Technology | Purpose |
|------------|---------|
| React + TypeScript | UI framework |
| Redux Toolkit | Global state |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| Vercel | Deployment |

---

## 🔐 Security

| Layer | Implementation |
|-------|----------------|
| Rate limiting | 20 requests per 15 minutes per IP on all AI endpoints |
| Token quota | 50,000 tokens per user per month — resets automatically |
| Input validation | Length limits + prompt injection pattern detection |
| Org scoping | Every DB query filtered by organizationId — no cross-tenant data access |
| JWT auth | All endpoints protected — role-based admin/member access |
| API key security | Keys in .env only — never in client code |

---

## 🗄️ Database Schema

Organization ──< User
Organization ──< Document ──< DocumentChunk (vector embeddings)
Organization ──< SemanticCache (cached Q&A embeddings)


- **Organization** — top-level tenant. All data scoped here
- **User** — belongs to org, role admin/member, tracks aiTokensUsed
- **Document** — uploaded file, status (processing/ready/failed), chunkCount
- **DocumentChunk** — parsed text chunk + 1024-dim vector embedding
- **SemanticCache** — cached query + answer + citations + embedding

---

## ⚙️ Installation & Setup

### 1. Clone
```bash
git clone https://github.com/joshu1024/enterprise-ai-kb.git
cd enterprise-ai-kb/server
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create `server/.env`:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_jwt_secret_min_32_chars
ALLOWED_ORIGINS=http://localhost:5173
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=groq/compound-mini
COHERE_API_KEY=your_cohere_api_key
```

### 4. Enable pgvector
```sql
-- Run in your Neon SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### 5. Push schema
```bash
npx prisma db push
npx prisma generate
```

### 6. Create HNSW index
```sql
-- Run in Neon SQL editor
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
ON "DocumentChunk"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 7. Start server
```bash
npm run dev
```

Server runs on **http://localhost:4000**

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account + organization | Public |
| POST | `/api/auth/login` | Login | Public |
| GET | `/api/auth/me` | Get current user | Protected |
| POST | `/api/documents/upload` | Upload and ingest document | Admin |
| GET | `/api/documents` | List org documents | Protected |
| GET | `/api/documents/:id/status` | Check processing status | Protected |
| DELETE | `/api/documents/:id` | Delete document | Admin |
| POST | `/api/rag/query` | Query documents — SSE streaming | Protected |
| GET | `/api/rag/stats` | Token usage and cost stats | Admin |
| POST | `/api/rag/eval` | RAGAS-style eval on a response | Admin |

---

## 📸 Screenshots

Coming soon — frontend in progress.

---

## ☁️ Deployment

### Backend on Render
1. New Web Service → connect GitHub repo
2. Root Directory: `server`
3. Build Command: `npm install && npx prisma generate`
4. Start Command: `npm start`
5. Add all environment variables

### Frontend on Vercel
Coming soon.

---

## 🧑‍💻 Author

**Joshua Kipamet Olting'idi**

- 💼 [LinkedIn](#)
- 💻 [GitHub @joshu1024](https://github.com/joshu1024)

---

## ⭐ Acknowledgements

- Cohere — free embeddings API
- Groq — free LLM inference
- Neon — serverless PostgreSQL
- Prisma — TypeScript ORM
- pgvector — vector similarity in PostgreSQL

---

💡 If you found this useful, please give it a ⭐ on GitHub!
