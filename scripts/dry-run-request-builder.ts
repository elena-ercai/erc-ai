/**
 * Dry-run test for buildAIRequest() and buildModelMessages().
 *
 * Uses the SAME buildAIAnalysisContext() function that the real
 * analyzeShipment() pipeline uses — no manually duplicated test-only
 * context.
 *
 * Tests the Taiwan → Germany shipment example to verify the prepared
 * request includes all required fields and no secrets or stale data.
 *
 * No network call is made. No API key is used.
 */

import { buildAIRequest, buildModelMessages } from "../services/ai/request-builder";
import { buildAIAnalysisContext, analyzeShipment } from "../services/ai";
import { ERC_AI_SYSTEM_PROMPT } from "../services/ai/prompts";
import type { Shipment } from "@/lib/models";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("=== Step 8.1 Dry-Run: buildAIRequest() via buildAIAnalysisContext() ===\n");

  // Taiwan → Germany shipment (same as regression Test B)
  const shipment: Shipment = {
    productName: "Stainless steel fabricated mounting bracket for industrial machinery",
    hsCode: "7326.90.98",
    productCategory: "Industrial metal component / Machinery part",
    productCharacteristics: "Fabricated stainless steel bracket; welded and machined; non-food-contact product; non-electrical; designed for industrial machinery installation.",
    exportingCountry: "Taiwan",
    destinationCountry: "Germany",
    countryOfOrigin: "Taiwan",
    plannedImportDate: "2026-11-15",
    buyerImporter: "DE Industrial Systems GmbH (Demo Buyer)",
    endUse: "Industrial machinery installation and structural mounting.",
    supplyChainInformation: "Manufactured in Taiwan from stainless steel plate supplied by a Taiwan steel supplier. Cutting, welding, machining, finishing and final inspection completed in Taiwan.",
    certificates: "Commercial Invoice, Packing List, Certificate of Origin, Mill Certificate, Material Specification Sheet",
  };

  // Use the SAME context builder the real pipeline uses
  const context = buildAIAnalysisContext(shipment);
  const request = buildAIRequest(context);

  // --- 1. System prompt ---
  console.log("1. System Prompt:");
  check("systemPrompt is ERC_AI_SYSTEM_PROMPT", request.systemPrompt === ERC_AI_SYSTEM_PROMPT);
  check("systemPrompt non-empty", request.systemPrompt.length > 1000, `${request.systemPrompt.length} chars`);
  check("systemPrompt contains 'ERC AI'", request.systemPrompt.includes("ERC AI"));
  check("systemPrompt contains EVIDENCE/REASONING/RISK/ACTION", request.systemPrompt.includes("EVIDENCE") && request.systemPrompt.includes("REASONING") && request.systemPrompt.includes("RISK") && request.systemPrompt.includes("ACTION"));

  // --- 2. Shipment facts ---
  console.log("\n2. Shipment Facts:");
  const ship = request.userPayload.shipment;
  check("productName included", ship.productName.includes("Stainless steel fabricated mounting bracket"));
  check("hsCode included", ship.hsCode === "7326.90.98");
  check("exportJurisdiction is TW", ship.exportJurisdiction === "Taiwan");
  check("destinationJurisdiction is Germany", ship.destinationJurisdiction === "Germany");
  check("plannedImportDate included", ship.plannedImportDate === "2026-11-15");
  check("buyerImporter included", !!ship.buyerImporter);
  check("productCategory included", !!ship.productCategory);
  check("keyProductCharacteristics included", !!ship.keyProductCharacteristics);
  check("knownCertificates included", Array.isArray(ship.knownCertificates) && ship.knownCertificates.length > 0);

  // Verify NO company/order location fields
  const shipJson = JSON.stringify(ship);
  check("no companyJurisdiction field", !shipJson.includes("companyJurisdiction"));
  check("no orderJurisdiction field", !shipJson.includes("orderJurisdiction"));
  check("no headquarters field", !shipJson.includes("headquarters"));

  // --- 3. Regulatory source context ---
  console.log("\n3. Regulatory Source Context:");
  const sources = request.userPayload.regulatorySources;
  check("regulatorySources is array", Array.isArray(sources));
  check("regulatorySources has entries", sources.length > 0, `${sources.length} sources`);

  // Check for EU CBAM legal provision source from the source registry
  const euCbamSource = sources.find((s) =>
    s.sourceId === "eu-cbam-regulation" || s.sourceId === "de-eu-cbam-regulation",
  );
  check("EU CBAM legal-provision source present", !!euCbamSource, euCbamSource?.sourceId ?? "not found");
  if (euCbamSource) {
    check("EU CBAM source has legalInstrument", euCbamSource.legalInstrument === "Regulation (EU) 2023/956");
    check("EU CBAM source has relevantProvision with Annex I", euCbamSource.relevantProvision?.includes("Annex I") ?? false);
    check("EU CBAM source has citation", !!euCbamSource.citation);
    check("EU CBAM source granularity is LEGAL_PROVISION", euCbamSource.sourceGranularity === "LEGAL_PROVISION");
    check("EU CBAM source has directSourceUrl", !!euCbamSource.directSourceUrl);
    check("EU CBAM source evidenceText contains legal instrument", euCbamSource.evidenceText?.includes("Regulation (EU) 2023/956") ?? false);
    check("EU CBAM regulatoryDomains includes CBAM", euCbamSource.regulatoryDomains.includes("CBAM"));
  }

  // Check for Germany-specific CBAM guidance
  const deCbamSource = sources.find((s) => s.sourceId === "de-zoll-cbam");
  check("Germany CBAM guidance source present", !!deCbamSource, deCbamSource?.sourceId ?? "not found");
  if (deCbamSource) {
    check("Germany source side is DESTINATION", deCbamSource.side === "DESTINATION");
    check("Germany source granularity is SPECIFIC_GUIDANCE", deCbamSource.sourceGranularity === "SPECIFIC_GUIDANCE");
    check("Germany source has legalInstrument", deCbamSource.legalInstrument === "Regulation (EU) 2023/956");
  }

  // Check for Taiwan export-side sources
  const twSources = sources.filter((s) => s.jurisdiction === "Taiwan");
  check("Taiwan export sources present", twSources.length > 0, `${twSources.length} sources`);
  check("all Taiwan sources are EXPORT side", twSources.every((s) => s.side === "EXPORT"));

  // Check no US sources (unrelated jurisdiction)
  const usSources = sources.filter((s) => s.jurisdiction === "United States");
  check("no United States sources (unrelated jurisdiction)", usSources.length === 0);

  // Check no UK sources (unrelated jurisdiction)
  const ukSources = sources.filter((s) => s.jurisdiction === "United Kingdom");
  check("no United Kingdom sources (unrelated jurisdiction)", ukSources.length === 0);

  // --- 4. Deterministic context ---
  console.log("\n4. Deterministic Context:");
  const detCtx = request.userPayload.deterministicContext;
  check("deterministicContext is array", Array.isArray(detCtx));
  check("deterministicContext has entries", detCtx.length >= 2, `${detCtx.length} entries`);

  // Coverage entries
  const coverageEntries = detCtx.filter((d) => d.coverageStatus && !d.regulationName);
  check("coverage entries present", coverageEntries.length >= 2);

  // EU CBAM deterministic entry
  const cbamDet = detCtx.find((d) => d.regulationName?.includes("EU Carbon Border Adjustment"));
  check("EU CBAM regulationName in deterministicContext", !!cbamDet, cbamDet?.regulationName ?? "not found");
  if (cbamDet) {
    check("effectiveDateStatus is ACTIVE", cbamDet.effectiveDateStatus === "ACTIVE", cbamDet.effectiveDateStatus ?? "undefined");
    check("thresholdResult present", !!cbamDet.thresholdResult);
    check("coverageStatus present", !!cbamDet.coverageStatus);
  }

  // --- 5. Allowed source IDs ---
  console.log("\n5. Allowed Source IDs:");
  const allowed = request.allowedSourceIds;
  check("allowedSourceIds is array", Array.isArray(allowed));
  check("allowedSourceIds has entries", allowed.length > 0, `${allowed.length} IDs`);

  // Source allowlist validation: every allowed ID exists in regulatorySources
  const sourceIdSet = new Set(sources.map((s) => s.sourceId));
  const allAllowedExist = allowed.every((id) => sourceIdSet.has(id));
  check("every allowedSourceId exists in regulatorySources", allAllowedExist);

  // No stale source IDs from unrelated jurisdictions
  const staleIds = allowed.filter((id) => id.startsWith("us-") || id.startsWith("uk-"));
  check("no stale US/UK source IDs", staleIds.length === 0, staleIds.join(", ") || "none");

  // Allowed IDs should match source registry IDs (not sequential s1/s2)
  const sequentialIds = allowed.filter((id) => /^s\d+$/.test(id));
  check("no sequential s1/s2 IDs (using registry IDs)", sequentialIds.length === 0);

  // --- 6. Message content ---
  console.log("\n6. Message Content:");
  const messages = buildModelMessages(request);
  check("messages is array of 2", Array.isArray(messages) && messages.length === 2);
  check("first message role is system", messages[0].role === "system");
  check("first message content is systemPrompt", messages[0].content === request.systemPrompt);
  check("second message role is user", messages[1].role === "user");

  const userContent = JSON.parse(messages[1].content);
  check("user message has shipment", !!userContent.shipment);
  check("user message has regulatorySources", Array.isArray(userContent.regulatorySources));
  check("user message has deterministicContext", Array.isArray(userContent.deterministicContext));
  check("user message has allowedSourceIds", Array.isArray(userContent.allowedSourceIds));

  // Verify NO secrets in the user message
  const userMsgStr = messages[1].content;
  check("no API key in user message", !userMsgStr.toLowerCase().includes("apikey") && !userMsgStr.toLowerCase().includes("api_key"));
  check("no NEXT_PUBLIC secret in user message", !userMsgStr.includes("NEXT_PUBLIC"));
  check("no environment secret in user message", !userMsgStr.includes("SUPABASE") && !userMsgStr.includes("NEBIUS_KEY"));
  check("no previous shipment data (no 'previousShipment' key)", !userMsgStr.includes("previousShipment"));
  check("no client session data (no 'session' key)", !userMsgStr.includes("session"));
  check("no company order location", !userMsgStr.includes("orderJurisdiction") && !userMsgStr.includes("headquarters"));

  // --- 7. No fake evidence for missing sources ---
  console.log("\n7. No Fake Evidence:");
  const generalSources = sources.filter((s) => s.sourceGranularity === "GENERAL_AUTHORITY");
  for (const gs of generalSources) {
    check(`general source ${gs.sourceId} has no fabricated legal text`,
      !gs.evidenceText?.includes("Regulation (EU)") && !gs.evidenceText?.includes("Article "),
      gs.evidenceText ?? "no evidenceText");
  }

  // --- 8. Request does NOT contain RiskReport-level fields ---
  console.log("\n8. No RiskReport-level fields sent to model:");
  const fullRequestStr = JSON.stringify(request);
  check("no 'summary' field in request", !fullRequestStr.includes('"summary"'));
  check("no 'overallAssessment' field in request", !fullRequestStr.includes("overallAssessment"));
  check("no 'coverage' field in request (as object key)", !fullRequestStr.includes('"coverage"'));
  check("no 'evidenceChecklist' field in request", !fullRequestStr.includes("evidenceChecklist"));
  check("no 'carbonPriceCredit' field in request", !fullRequestStr.includes("carbonPriceCredit"));

  // --- 9. Context came from shared builder ---
  console.log("\n9. Shared Context Builder:");
  check("context.regulatorySources is populated", Array.isArray(context.regulatorySources) && context.regulatorySources.length > 0);
  check("context.deterministicContext has regulation entry", context.deterministicContext.some((d) => d.regulationName?.includes("EU Carbon Border Adjustment")));
  check("context.regulatorySources uses registry IDs", context.regulatorySources?.every((s) => !/^s\d+$/.test(s.sourceId)) ?? false);

  // --- 10. Canonical source ID consistency across all layers ---
  console.log("\n10. Canonical Source ID Consistency (Step 8.2):");

  // Run the full production pipeline to get the RiskReport
  const report = await analyzeShipment(shipment);
  const reportSourceIds = report.sources.map((s) => s.id);
  const reportSourceIdSet = new Set(reportSourceIds);

  // 10a. No sequential IDs anywhere in the report
  const reportSequential = reportSourceIds.filter((id) => /^s\d+$/.test(id));
  check("no sequential s1/s2 IDs in RiskReport.sources", reportSequential.length === 0, reportSequential.join(", ") || "none");

  // 10b. No duplicate source IDs in RiskReport.sources
  const dedupedReportIds = new Set(reportSourceIds);
  check("no duplicate source IDs in RiskReport.sources", dedupedReportIds.size === reportSourceIds.length, `${dedupedReportIds.size} unique / ${reportSourceIds.length} total`);

  // 10c. allowedSourceIds match regulatorySources IDs
  const ctxSourceIds = new Set((context.regulatorySources ?? []).map((s) => s.sourceId));
  const allowedFromCtx = request.allowedSourceIds.every((id) => ctxSourceIds.has(id));
  check("allowedSourceIds all exist in context.regulatorySources", allowedFromCtx);

  // 10d. The canonical EU CBAM legal-provision ID appears in all layers
  const canonicalCbamId = "de-eu-cbam-regulation";
  check(`canonical CBAM ID '${canonicalCbamId}' in regulatorySources`, (context.regulatorySources ?? []).some((s) => s.sourceId === canonicalCbamId));
  check(`canonical CBAM ID '${canonicalCbamId}' in allowedSourceIds`, request.allowedSourceIds.includes(canonicalCbamId));
  check(`canonical CBAM ID '${canonicalCbamId}' in RiskReport.sources`, reportSourceIdSet.has(canonicalCbamId));

  // 10e. CBAM finding's sourceIds reference the canonical ID
  const cbamFinding = report.findings.find((f) => f.domain === "CBAM");
  check("CBAM finding exists", !!cbamFinding);
  if (cbamFinding) {
    check(`CBAM finding sourceIds includes '${canonicalCbamId}'`, cbamFinding.sourceIds.includes(canonicalCbamId), `sourceIds: [${cbamFinding.sourceIds.join(", ")}]`);
    // All finding sourceIds must exist in RiskReport.sources
    const allFindingSourcesValid = cbamFinding.sourceIds.every((id) => reportSourceIdSet.has(id));
    check("all CBAM finding sourceIds exist in RiskReport.sources", allFindingSourcesValid);
  }

  // 10f. validateFindingSources passes (no ID remapping needed) — verified
  // by the fact that analyzeShipment() ran without console warnings. Check
  // that all findings reference only IDs present in report.sources.
  const allFindingsValid = report.findings.every((f) =>
    f.sourceIds.every((id) => reportSourceIdSet.has(id)),
  );
  check("all findings reference valid report source IDs", allFindingsValid);

  // 10g. No source-ID translation table needed — every report source ID
  // is a stable registry ID or an unresolved placeholder. The context is
  // built from shipment facts alone (before findings), so the report may
  // surface additional sources via finding categories. The key invariant
  // is that all IDs are registry-stable, not that the sets are identical.
  const { jurisdictionSources } = await import("../services/sources");
  const allRegistryIds = new Set<string>();
  for (const js of Object.values(jurisdictionSources)) {
    for (const s of js) allRegistryIds.add(s.id);
  }
  const nonRegistryReportIds = reportSourceIds.filter(
    (id) => !allRegistryIds.has(id) && !id.startsWith("unresolved-"),
  );
  check("all report source IDs are registry IDs or unresolved placeholders",
    nonRegistryReportIds.length === 0,
    nonRegistryReportIds.length ? nonRegistryReportIds.join(", ") : "none");

  // --- Result ---
  console.log(`\n=== Dry-Run Result: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed) ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Dry-run test crashed:", err);
  process.exit(1);
});
