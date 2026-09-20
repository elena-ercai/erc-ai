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
