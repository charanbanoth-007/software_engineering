# CareReq Studio

CareReq Studio is a local prototype for gathering healthcare software requirements. Its interface guides a project owner through a care setting, workflow, goals, stakeholders, and source documents, then asks adaptive follow-up questions. The project can index evidence, draft requirements with citations, show quality and risk findings, and recommend a software delivery approach for human review.

## Current healthcare migration status

The intake interface and requirement-generation prompt are healthcare-focused, but parts of the backend still use the original financial-services prototype. In particular, each project currently indexes RBI reference summaries and the compliance service can attach RBI control mappings. This means retrieved evidence and control suggestions may not be appropriate for healthcare projects.

Treat the app as a requirements-workflow prototype, not as a clinical, privacy, regulatory, or compliance system. Do not enter identifiable patient information or rely on generated content for clinical decisions. A complete healthcare migration still needs a healthcare-appropriate, reviewed knowledge base and control catalogue.

## Project workflow

1. **Care area** — choose a setting such as primary care, hospital care, diagnostics, virtual care, care coordination, or medication services, then name the workflow.
2. **Goals and people** — describe the intended care or operational outcome and the patients, care teams, and roles involved.
3. **Sources** — optionally add project documents in `.txt`, `.md`, `.csv`, `.pdf`, or `.docx` format and review a summary of the starting context.
4. **Guided interview** — answer or skip up to eight prompts. Follow-up selection uses keywords from the previous response to choose from a fixed question set; it is rule-based, not an AI-generated interview.
5. **Evidence** — review indexed sources and search for relevant project evidence.
6. **Requirements and review** — generate evidence-linked drafts, inspect quality findings, and record approval states.
7. **Delivery** — generate a ranked SDLC recommendation and project-specific workflow gates for review.

The backend workflow has four agents:

- **Requirements Agent** — creates and classifies draft requirements, attaches evidence, and runs deterministic checks.
- **Compliance & Risk Agent** — creates risk and traceability records and maps against the current RBI catalogue.
- **Documentation Agent** — derives SRS, user story, use case, risk, compliance, traceability, and open-issue artefacts.
- **Governance & SDLC Agent** — ranks delivery approaches and proposes project workflow gates.

Outputs are advisory and require human review. Agent runs and decisions are recorded in the project audit trail.

## Quick start

Requires Python 3.10 or later.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open <http://127.0.0.1:8000>. API documentation is available at <http://127.0.0.1:8000/docs> while the server is running.

## Enable LLM generation

The app works without an API key using local embeddings and evidence-only requirement drafts. To use an OpenAI-compatible provider, edit the `.env` file in the project root and add your key:

```text
LLM_API_KEY=replace_with_your_api_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

APP_DATA_DIR=data
VECTOR_DB_PATH=data/chroma
```

`OPENAI_API_KEY` is also accepted as an alternative to `LLM_API_KEY`. Use a model and embedding model available to your provider. Keep the key in `.env`; that file is ignored by Git. Do not put API keys in source code, exports, screenshots, or this README. Restart the server after changing `.env`.

The `/api/rag/status` endpoint reports whether the embedding provider is configured and which generation mode is active. It does not return secrets.

## Evidence and data handling

- Uploaded sources are limited to 5 MB each.
- The app extracts text, masks certain common account, card, tax-ID, and national-ID-like patterns, chunks the text, and indexes it for retrieval.
- Embeddings are stored in a persistent per-project ChromaDB collection; project data is stored locally as JSON.
- RBI reference summaries are currently indexed automatically for each project. They are financial-sector reference data and are not healthcare guidance.
- The sample document `sample_data/healthcare_followup_coordination.txt` is fictional example content for an outpatient follow-up workflow. It contains no real patient data and does not define clinical policy.

To try the sample, upload `sample_data/healthcare_followup_coordination.txt` during project setup and enter `Outpatient follow-up coordination` as the workflow name. Review retrieved sources carefully because the backend also indexes the legacy RBI reference summaries described above.

Avoid using real patient records or other sensitive health information with this prototype. Pattern masking is limited and does not make patient data safe to upload.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/rag/status` | Report safe RAG/provider status without secrets. |
| `POST` | `/api/projects` | Create a project and index its source chunks. |
| `GET` | `/api/projects/{project_id}/retrieval?query=...` | Retrieve ranked evidence chunks. |
| `POST` | `/api/projects/{project_id}/requirements` | Generate evidence-grounded draft requirements. |
| `POST` | `/api/projects/{project_id}/requirements/{requirement_id}/approval` | Record a requirement review decision. |
| `POST` | `/api/projects/{project_id}/sdlc` | Generate a delivery recommendation. |
| `POST` | `/api/projects/{project_id}/sdlc/approval` | Record an SDLC review decision. |
| `GET` | `/api/knowledge-base/rbi` | Inspect the legacy RBI source register and applicability notices. |
| `GET` | `/api/projects/{project_id}/artefacts` | Retrieve derived requirements and traceability artefacts. |
| `GET` | `/api/projects/{project_id}/evaluation` | Retrieve prototype evaluation metrics. |
| `GET` | `/api/projects/{project_id}/export` | Download the project audit trail as JSON. |

## Project structure

```text
app/
  main.py                 FastAPI routes and application lifecycle
  templates/index.html    Healthcare intake and project interface
  static/app.js            Intake flow and frontend interactions
  static/styles.css        Interface styling
  services/                RAG, generation, risk, documentation, and SDLC logic
  prompts/                 Requirement-generation prompt templates
sample_data/              Synthetic healthcare follow-up workflow example
tests/                    Automated checks
data/                     Local JSON projects and ChromaDB data
```

## Tests

From the project root, run:

```bash
.venv/bin/python -m pytest -q
```

## Limitations

This is a local prototype. It does not provide authentication, production-grade access controls, encrypted durable storage, a healthcare-validated regulatory catalogue, formal retention controls, or clinical decision support. Validate requirements, evidence, risks, and delivery recommendations with qualified clinical, privacy, security, and operational reviewers before using them in a real healthcare project.
