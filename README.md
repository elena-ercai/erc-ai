# ERC AI — Export Risk Check AI

**交易前，風險檢查。Check export risks before you trade.**

ERC AI is an AI-powered pre-export risk advisory tool that helps exporters and traders assess regulatory risks before deciding to enter a market or trade.

## Current Status

### Working Features

- **Ercie conversational wizard** (`components/ercie.tsx`) — A multi-language (English, Traditional Chinese, Simplified Chinese, Japanese) step-by-step form assistant that guides users through 12 shipment fields with field-level explanations, re-asking on "I don't know", and skip for optional fields.
- **HS Code validation** — Accepts only 6-digit or 8-digit numeric HS Codes; rejects 7-digit codes.
- **HS Code lookup** (`lib/hs-code-sources.ts`) — Country-specific official HS Code lookup links. Currently Taiwan has two verified sources (Taiwan Customs, Taiwan Trade Bureau). Other countries show a "no verified source" message directing users to the relevant customs authority.
- **Export country change detection** — If the user changes the export country after confirming an HS Code, the wizard prompts re-confirmation before allowing submission.
- **Review page** (`app/check/review/page.tsx`) — Shows the final confirmed English form. The user must click "Start Risk Check" to trigger the API. No auto-submission.
- **Risk report** — Displays a multi-tab report with Executive Summary, Detail by Regulation, Evidence Checklist, Sources, and Confirmed Form tabs.
- **Buyer-less operation** — When no buyer/importer is provided, the report displays "未提供買主資料，本次未執行買主風險檢查" and does NOT generate any buyer risk screening findings.
- **Data disclaimer** — Reports include "本報告依據您確認提供的資料產生。ERC AI does not provide official approval, clearance, or verify data authenticity."
- **Responsive design** — Desktop and mobile layouts with proper breakpoints.

### MOCK / Not Yet Implemented

- **AI provider** — The risk analysis uses a MOCK provider (`services/ai/providers/mock.ts`) with deterministic jurisdiction-aware logic. The Nebius AI provider (`services/ai/providers/nebius.ts`) exists but is not connected. Ercie itself is a fixed-step conversational UI with pre-written prompts — it does NOT use natural language understanding, AI-powered follow-up questions, or AI-based field mapping. All prompts and responses are hardcoded in `components/ercie.tsx`.
- **Buyer / entity risk screening** — Not implemented. The mock provider does not perform sanctions checks, buyer scoring, or entity risk screening. The `BUYER_ENTITY_RISK` domain is mapped but never triggered.
- **Document-assisted form filling** — The upload area in the wizard displays "coming soon". No file upload or OCR functionality exists.
- **HS Code vs product name cross-check** — Not implemented. The wizard accepts the HS Code as entered; it does not verify that the code matches the product description.
- **Confirmed Form export** — The "Confirmed Form" tab in the report is a display-only view within the report page. It is NOT an exportable attachment. PDF download is also not implemented.
- **Report PDF generation** — The "Download PDF" button shows an alert indicating it will be enabled in a later build.
- **Data persistence** — Reports and shipments are stored in browser localStorage only. No database backend is connected.

## Architecture

```
app/
  check/new/          — Ercie wizard (conversational intake)
  check/review/       — Final English form review + "Start Risk Check" button
  check/results/[id]/  — Risk report with 5 tabs
  api/analyze-shipment/ — POST endpoint that runs the mock analysis pipeline
components/
  ercie.tsx           — Multi-language conversational wizard
lib/
  app-components.tsx  — Shared UI (Dashboard, Review, Report, AppShell, etc.)
  hs-code-sources.ts  — Country-specific HS Code lookup sources
  models.ts           — Shipment and RiskReport TypeScript types
services/
  ai/                 — Analysis pipeline (mock + Nebius providers)
  risk-engine/        — Schema, coverage status, effective-date logic
  sources/            — Regulatory source registry
  regulations/        — Regulation definitions (UK CBAM, EU CBAM, etc.)
```

## Testing

```bash
npm run typecheck              # TypeScript type checking
npm run build                  # Production build
npx tsx scripts/regression-test.ts       # 3 shipment scenarios (A/B/C)
npx tsx scripts/dry-run-request-builder.ts  # 80 context-building checks
```

## Tech Stack

- Next.js 13.5 (App Router)
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Lucide React icons
---
Day 3 progress (20 September 2026)
Check export risks before you trade. ERC AI is a private decision-support service based on information the user provides; it does not verify the authenticity of user documents or issue official approvals.

The intake is now form first. Users can edit the form directly and optionally open Ask Ercie for fixed field guidance. Ercie's AI conversation, multilingual extraction, and translation are not connected yet.

Required fields: product name / description, HS Code, export country, country of origin, and destination country. Buyer/importer information is optional. Without a buyer, buyer screening is not performed; buyer screening is not implemented yet even when a buyer is supplied.

HS Code lookup links depend on the export country. Taiwan has official lookup links; other countries must not reuse Taiwan's links. The user acknowledges the product, code, and export country combination. This is not an official or AI-verified classification.

One browser-stored draft is supported. Starting a new check asks before replacing an existing draft. Confirm opens the complete English-form review; only Start Risk Check calls the analysis API.

The report displays the confirmed form, but PDF download and an exportable form attachment are not yet implemented.

Architecture: the editable form and optional Ercie guidance lead to an English-form review, then a separate risk-check API and report. Ercie and risk analysis may later share one configured AI provider while using separate roles and output formats. Asking Ercie for help must never trigger a risk check. The risk-check runtime is currently MOCK, and live official-source retrieval and supported risk findings still require implementation and verification. Report data currently lives in browser storage.

Bolt reported passing type checks, build, and regression tests. End-to-end browser testing and a live regulatory accuracy review are still pending. MOCK output must not be presented as a real risk assessment during the association pilot.
