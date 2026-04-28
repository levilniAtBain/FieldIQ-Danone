import Anthropic from "@anthropic-ai/sdk";

// Singleton client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { client };

/**
 * Extract the first complete JSON object or array from a Claude response.
 * Handles markdown fences, surrounding prose, and thinking-mode artifacts.
 */
function extractJson(text: string): string {
  // 1. Strip markdown code fences
  const stripped = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  // 2. Find the outermost { ... } block
  const objStart = stripped.indexOf("{");
  const arrStart = stripped.indexOf("[");

  if (objStart === -1 && arrStart === -1) {
    throw new Error("No JSON found in response");
  }

  const start =
    objStart === -1
      ? arrStart
      : arrStart === -1
      ? objStart
      : Math.min(objStart, arrStart);

  const openChar = stripped[start];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }

  // Fallback: return the whole stripped text
  return stripped;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShelfAnalysisResult = {
  stockouts: string[];
  lowStock: string[];
  competitorPresence: string[];
  planogramIssues: string[];
  recommendations: string[];
  overallScore: number; // 1-10
  summary: string;
};

export type OrderScanResult = {
  lineItems: Array<{
    productName: string;
    sku: string | null;
    quantity: number;
    notes: string | null;
  }>;
  confidence: "high" | "medium" | "low";
  rawText: string;
  warnings: string[];
};

export type VoiceSummaryResult = {
  summary: string;
  keyPoints: string[];
  actions: string[];
  sentiment: "positive" | "neutral" | "negative";
};

// ─── Pre-visit briefing (streaming) ─────────────────────────────────────────

export interface BriefingContext {
  pharmacyName: string;
  pharmacistName: string | null;
  city: string;
  tier: string;
  segment: string | null;
  notes: string | null;
  repName: string;
  lastVisitDate: string | null;
  lastVisitNotes: string | null;
  visitCount: number;
  pendingActions: string[];
}

export async function streamPreVisitBriefing(
  context: BriefingContext,
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const prompt = `You are a field sales intelligence assistant for Danone. Generate a concise pre-visit briefing for the following pharmacy account.

Account details:
- Name: ${context.pharmacyName}
- City: ${context.city}
- Segment: ${context.tier?.toUpperCase()} (${context.tier === "a" ? "Strategic Partners — weekly, full PICOS" : context.tier === "b" ? "Core Pharmacies — bi-weekly, light PICOS" : context.tier === "c" ? "Development — monthly, simplified PICOS" : "Long-Tail / Self-Serve — not visited"})
- Segment: ${context.segment ?? "general"}
- Pharmacist: ${context.pharmacistName ?? "unknown"}
- Rep: ${context.repName}
- Total visits recorded: ${context.visitCount}
- Last visit: ${context.lastVisitDate ?? "never"}
- Last visit notes: ${context.lastVisitNotes ?? "none"}
- Account notes: ${context.notes ?? "none"}
- Pending actions: ${context.pendingActions.length > 0 ? context.pendingActions.join("; ") : "none"}

Write a focused briefing (3-4 short paragraphs) covering:
1. Account status and relationship context
2. Key priorities for this visit based on history
3. Recommended Danone products or promotions to discuss (Nutricia Fortimel, Gallia, Aptamil, Blédina, Evian, Volvic, etc.)
4. Any specific follow-ups from the last visit

Keep it practical and actionable. Write in English.`;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }
  onDone();
}

// ─── Shelf photo analysis ────────────────────────────────────────────────────

export async function analyzeShelfPhoto(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  pharmacyContext: { name: string; tier: string; segment: string | null }
): Promise<ShelfAnalysisResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this pharmacy shelf photo for ${pharmacyContext.name} (${pharmacyContext.tier} tier, ${pharmacyContext.segment ?? "general"} segment).

Focus on Danone brands: Nutricia (Fortimel, Nutrison), Gallia, Aptamil, Blédina, Evian, Volvic.

Return a JSON object with this exact structure:
{
  "stockouts": ["product names with empty shelf space"],
  "lowStock": ["product names with only 1-2 units remaining"],
  "competitorPresence": ["competitor brand names visible"],
  "planogramIssues": ["specific planogram or facing problems"],
  "recommendations": ["actionable recommendations for the rep"],
  "overallScore": 7,
  "summary": "2-3 sentence overall assessment"
}

Return only valid JSON, no markdown.`,
          },
        ],
      },
    ],
  });

  // Extract text from response (skip thinking blocks)
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from shelf analysis");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as ShelfAnalysisResult;
  } catch (e) {
    console.error("[shelf] Parse failed. Raw response:", textBlock.text.slice(0, 800));
    throw new Error(`Failed to parse shelf analysis response: ${(e as Error).message}`);
  }
}

// ─── Handwritten order scan ──────────────────────────────────────────────────

export async function scanOrderImage(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp"
): Promise<OrderScanResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `This is a handwritten or printed pharmacy order sheet. Extract all product orders.

For each line item, extract the product name, SKU/reference code if visible, and quantity.

Return a JSON object with this exact structure:
{
  "lineItems": [
    {
      "productName": "CeraVe Moisturizing Cream",
      "sku": "CVE-001",
      "quantity": 6,
      "notes": "any special instructions or notes for this line"
    }
  ],
  "confidence": "high",
  "rawText": "verbatim text you could read from the image",
  "warnings": ["any items that were unclear or ambiguous"]
}

confidence should be: "high" (clear writing, all items legible), "medium" (some ambiguity), "low" (significant portions unclear).
Return only valid JSON, no markdown.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from order scan");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as OrderScanResult;
  } catch {
    throw new Error("Failed to parse order scan response");
  }
}

// ─── Voice note summarization ────────────────────────────────────────────────

export async function summarizeVoiceNote(
  transcript: string,
  pharmacyContext: { name: string; repName: string }
): Promise<VoiceSummaryResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are a field sales assistant for L'Oréal. A sales rep (${pharmacyContext.repName}) recorded voice notes during a visit to ${pharmacyContext.name}.

Transcript:
"""
${transcript}
"""

Summarize this into a structured visit note. Return a JSON object:
{
  "summary": "2-3 sentence summary of what happened during the visit",
  "keyPoints": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "actions": ["follow-up action 1", "follow-up action 2"],
  "sentiment": "positive"
}

sentiment should be: "positive" (good visit, receptive pharmacist), "neutral", or "negative" (issues, objections).
Return only valid JSON, no markdown.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from voice summary");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as VoiceSummaryResult;
  } catch {
    throw new Error("Failed to parse voice summary response");
  }
}

// ─── CSV product matching ────────────────────────────────────────────────────

export type CsvRawLine = { rawName: string; rawSku: string | null; qty: number };
export type MatchedLine = {
  rawName: string;
  rawSku: string | null;
  qty: number;
  productId: string | null;
  matchedSku: string | null;
  confidence: "exact" | "fuzzy" | "ai" | null;
};

/** Normalize a string for fuzzy comparison */
function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

export async function matchCsvLinesToProducts(
  rawLines: CsvRawLine[],
  catalog: Array<{ id: string; sku: string; name: string; brand: string }>
): Promise<MatchedLine[]> {
  const results: MatchedLine[] = [];
  const unmatched: CsvRawLine[] = [];

  for (const line of rawLines) {
    // Step 1: exact SKU match
    if (line.rawSku) {
      const exact = catalog.find(
        (p) => p.sku.toLowerCase() === line.rawSku!.toLowerCase()
      );
      if (exact) {
        results.push({ ...line, productId: exact.id, matchedSku: exact.sku, confidence: "exact" });
        continue;
      }
    }

    // Step 2: fuzzy name match — name contains all tokens from raw name (or vice versa)
    const rawTokens = normStr(line.rawName).split(" ").filter((t) => t.length > 2);
    const fuzzy = catalog.find((p) => {
      const catNorm = normStr(p.name);
      return rawTokens.length > 0 && rawTokens.every((t) => catNorm.includes(t));
    });
    if (fuzzy) {
      results.push({ ...line, productId: fuzzy.id, matchedSku: fuzzy.sku, confidence: "fuzzy" });
      continue;
    }

    unmatched.push(line);
  }

  // Step 3: AI batch match for remaining unmatched lines
  if (unmatched.length > 0) {
    const catalogList = catalog
      .map((p) => `${p.sku} | ${p.name} | ${p.brand}`)
      .join("\n");
    const linesList = unmatched
      .map((l, i) => `${i}: ${l.rawName}${l.rawSku ? ` (code: ${l.rawSku})` : ""}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Match each pharmacy product to the closest Danone catalog entry. These are French pharmacy system exports (Winpharma/LGPI) — product names may be truncated or abbreviated.

Catalog (SKU | Name | Brand):
${catalogList}

Products to match (index: name):
${linesList}

For each index, return the best matching SKU from the catalog, or null if no reasonable match exists. Return JSON only:
[{"index": 0, "matchedSku": "CER-001"}, {"index": 1, "matchedSku": null}]`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      try {
        const aiMatches = JSON.parse(extractJson(textBlock.text)) as Array<{
          index: number;
          matchedSku: string | null;
        }>;
        for (const match of aiMatches) {
          const line = unmatched[match.index];
          if (!line) continue;
          if (match.matchedSku) {
            const product = catalog.find((p) => p.sku === match.matchedSku);
            results.push({
              ...line,
              productId: product?.id ?? null,
              matchedSku: match.matchedSku,
              confidence: product ? "ai" : null,
            });
          } else {
            results.push({ ...line, productId: null, matchedSku: null, confidence: null });
          }
        }
      } catch {
        // AI parse failed — push all as unmatched
        for (const line of unmatched) {
          results.push({ ...line, productId: null, matchedSku: null, confidence: null });
        }
      }
    } else {
      for (const line of unmatched) {
        results.push({ ...line, productId: null, matchedSku: null, confidence: null });
      }
    }
  }

  return results;
}

// ─── AI order builder ────────────────────────────────────────────────────────

export type OrderLineItem = {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  source: "history" | "scan" | "voice" | "peer" | "manual";
};

export interface OrderBuilderContext {
  pharmacyName: string;
  accountType?: string;
  doctorNotes?: string | null;
  mainSpecialty?: string | null;
  secondarySpecialty?: string | null;
  shelfAnalyses: ShelfAnalysisResult[];
  lastOrderLines: Array<{ sku: string; name: string; quantity: number; brand: string }>;
  scannedOrderItems: Array<{ productName: string; sku: string | null; quantity: number }>;
  voiceTranscript: string | null;
  peerSuggestions: Array<{ sku: string; name: string; peerAvgQty: number; brand: string }>;
  availableProducts: Array<{ id: string; sku: string; name: string; brand: string; unitPrice: string | null }>;
  sellOutData?: Array<{ sku: string; name: string; qtySold: number; periodLabel: string | null }>;
  stockData?: Array<{ sku: string; name: string; qtyInStock: number }>;
}

export type AiOrderResult = {
  lines: Array<{
    sku: string;
    quantity: number;
    rationale: string;
    source: "history" | "scan" | "voice" | "peer";
  }>;
  summary: string;
  warnings: string[];
};

export async function buildOrderWithAI(context: OrderBuilderContext): Promise<AiOrderResult> {
  const skuList = context.availableProducts.map((p) => `${p.sku} — ${p.name} (${p.brand})`).join("\n");
  const isHospital = context.accountType === "hospital";

  const shelfContext = context.shelfAnalyses.length > 0
    ? context.shelfAnalyses.map((a, i) => {
        const parts = [isHospital
          ? `Stock photo ${i + 1}: ${a.summary}`
          : `Shelf photo ${i + 1} (score ${a.overallScore}/10): ${a.summary}`];
        if (a.stockouts.length) parts.push(`  Stockouts: ${a.stockouts.join(", ")}`);
        if (a.lowStock.length) parts.push(`  Low stock: ${a.lowStock.join(", ")}`);
        if (!isHospital && a.recommendations.length) parts.push(`  AI recommendations: ${a.recommendations.join("; ")}`);
        return parts.join("\n");
      }).join("\n\n")
    : isHospital ? "  No stock photos taken" : "  No shelf photos taken";

  const hospitalSection = isHospital ? `
HOSPITAL / PUI ACCOUNT — CLINICAL ORDERING CONTEXT
Account: ${context.pharmacyName}
Main specialty: ${context.mainSpecialty ?? "not specified"}
Secondary specialty: ${context.secondarySpecialty ?? "none"}

Doctor/service clinical notes (KEY — read carefully to understand formulary status and opportunities):
${context.doctorNotes ?? "No notes available"}

Interpretation guide for the clinical notes:
- Phrases like "en formulaire", "référencé", "en protocole" → product already ordered; use previous order as baseline and replenish
- Phrases like "intérêt", "à qualifier", "à développer", "ouvert à" → product not yet ordered; flag as an introduction opportunity (source: "peer")
- Phrases like "prescrit systématiquement", "très fort volume", "référent" → high-volume product; prioritise generous quantities
- Product names mentioned in notes but absent from previous orders → likely introduction target; propose a small trial quantity

For hospital accounts, ignore shelf replenishment logic. Orders reflect the PUI's clinical stock needs, not retail sell-out.
` : "";

  const prompt = `You are a field sales assistant for Danone. Build a ${isHospital ? "hospital PUI clinical stock" : "pharmacy replenishment"} order for ${context.pharmacyName}.
${hospitalSection}
Available products (SKU — Name — Brand):
${skuList}

Last order from this account:
${context.lastOrderLines.length > 0
  ? context.lastOrderLines.map((l) => `  ${l.sku} ${l.name}: ${l.quantity} units`).join("\n")
  : "  No previous order on record"}

${isHospital ? `Stock photos from this visit (PUI storage room — use to detect stockouts and low stock):
${shelfContext}

` : `Shelf analysis from this visit:
${shelfContext}

`}Scanned/typed notes from this visit (may reference products or quantities):
${context.scannedOrderItems.length > 0
  ? context.scannedOrderItems.map((i) => `  ${i.sku ?? "?"} ${i.productName}: ${i.quantity}`).join("\n")
  : "  None"}

Voice notes from this visit:
${context.voiceTranscript ?? "None"}

${isHospital ? `Current PUI stock (from inventory scan):
${context.stockData && context.stockData.length > 0
  ? context.stockData.map((s) => `  ${s.sku} ${s.name}: ${s.qtyInStock} units`).join("\n")
  : "  Not available"}

` : `Sell-out data (what this account sold since last visit):
${context.sellOutData && context.sellOutData.length > 0
  ? context.sellOutData.map((s) => `  ${s.sku} ${s.name}: ${s.qtySold} units sold${s.periodLabel ? ` (${s.periodLabel})` : ""}`).join("\n")
  : "  Not available"}

Current stock:
${context.stockData && context.stockData.length > 0
  ? context.stockData.map((s) => `  ${s.sku} ${s.name}: ${s.qtyInStock} units`).join("\n")
  : "  Not available"}

`}Products frequently ordered by peer accounts with same specialty:
${context.peerSuggestions.length > 0
  ? context.peerSuggestions.map((p) => `  ${p.sku} ${p.name}: avg ${p.peerAvgQty} units`).join("\n")
  : "  No peer data"}

Instructions:
${isHospital ? `1. Read the clinical notes carefully — they are the primary signal for what to order and in what quantities
2. Products already "en formulaire" or "en protocole": use previous order as baseline; adjust upward if notes indicate high volume ("très fort volume", "référent", "120 patients")
3. Products flagged as "intérêt" or "à qualifier" in the notes but absent from previous orders: add a small trial quantity (2-4 units), source "peer"
4. Only include products relevant to this doctor's specialty (${context.mainSpecialty ?? "general"} / ${context.secondarySpecialty ?? "none"}) — exclude unrelated lines
5. If stock photos are available, treat stockouts and low-stock items as urgent replenishment needs (override baseline quantity upward)
6. If current PUI stock is available, use it to avoid over-ordering: skip or reduce products already well-stocked unless notes indicate high consumption
7. Apply any adjustments from scanned or voice notes
8. Only include SKUs from the available products list
9. Provide a rationale for each line referencing clinical notes, stock photo, or inventory data` : `1. Start from the previous order as the baseline
2. Prioritize replenishing stockouts and low-stock items from shelf photos
3. Use sell-out data as the primary quantity signal:
   - High sell-out + low stock → urgent replenishment, quantity ≥ sell-out volume
   - High sell-out + adequate stock → small top-up
   - Low sell-out + high stock → skip or reduce
4. Apply adjustments from scanned or voice notes
5. Consider peer suggestions for uncovered products
6. Only include SKUs from the available products list
7. Provide a brief rationale for each line`}

Return JSON only — no markdown:
{
  "lines": [
    { "sku": "DAN-NUT-FORTPROT-VAN-200ML4", "quantity": 6, "rationale": "en formulaire service réanimation, volume élevé", "source": "history" },
    { "sku": "DAN-NUT-KETOCAL41-300G", "quantity": 2, "rationale": "intérêt exprimé dans les notes pour neurologie pédiatrique — introduction trial", "source": "peer" }
  ],
  "summary": "One sentence describing the order",
  "warnings": ["any items from notes that couldn't be matched to a SKU"]
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from AI order builder");
  }

  const raw = extractJson(textBlock.text);

  try {
    return JSON.parse(raw) as AiOrderResult;
  } catch {
    console.error("Failed to parse AI order response. Raw text:", textBlock.text.slice(0, 500));
    throw new Error("Failed to parse AI order response");
  }
}

// ─── Post-visit report generation (streaming) ─────────────────────────────────

export interface VisitReportContext {
  pharmacyName: string;
  repName: string;
  visitDate: string;
  objectives: string[];
  notes: string | null;
  voiceSummary: VoiceSummaryResult | null;
  shelfAnalysis: ShelfAnalysisResult | null;
  orderPlaced: boolean;
  orderTotal: number | null;
}

export async function streamVisitReport(
  context: VisitReportContext,
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const prompt = `You are a field sales assistant for Danone. Generate a professional visit report for Salesforce.

Visit details:
- Pharmacy: ${context.pharmacyName}
- Rep: ${context.repName}
- Date: ${context.visitDate}
- Objectives: ${context.objectives.length > 0 ? context.objectives.join("; ") : "general visit"}
- Notes: ${context.notes ?? "none"}
- Voice summary: ${context.voiceSummary ? context.voiceSummary.summary : "not recorded"}
- Key points: ${context.voiceSummary ? context.voiceSummary.keyPoints.join("; ") : "none"}
- Shelf analysis: ${context.shelfAnalysis ? context.shelfAnalysis.summary : "not performed"}
- Shelf score: ${context.shelfAnalysis ? `${context.shelfAnalysis.overallScore}/10` : "N/A"}
- Order placed: ${context.orderPlaced ? `Yes, total €${context.orderTotal ?? "unknown"}` : "No"}
- Follow-up actions: ${context.voiceSummary ? context.voiceSummary.actions.join("; ") : "none identified"}

Write a concise professional visit report (3-4 paragraphs) suitable for Salesforce:
1. Visit summary and relationship status
2. Key discussions and achievements vs objectives
3. Shelf/merchandising status
4. Next steps and follow-up actions

Write in English, professional tone.`;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }
  onDone();
}

// ─── Suggested visit objectives ──────────────────────────────────────────────

export async function suggestVisitObjectives(
  context: BriefingContext
): Promise<string[]> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a field sales intelligence assistant for Danone. Based on this pharmacy account, suggest 3-5 concrete visit objectives for the sales rep.

Account:
- Name: ${context.pharmacyName}
- City: ${context.city}
- Segment: ${context.tier?.toUpperCase()} (${context.tier === "a" ? "Strategic Partners — weekly, full PICOS" : context.tier === "b" ? "Core Pharmacies — bi-weekly, light PICOS" : context.tier === "c" ? "Development — monthly, simplified PICOS" : "Long-Tail / Self-Serve — not visited"})
- Segment: ${context.segment ?? "general"}
- Pharmacist: ${context.pharmacistName ?? "unknown"}
- Last visit: ${context.lastVisitDate ?? "never"}
- Last visit notes: ${context.lastVisitNotes ?? "none"}
- Account notes: ${context.notes ?? "none"}
- Pending actions: ${context.pendingActions.length > 0 ? context.pendingActions.join("; ") : "none"}

Return a JSON array of objective strings. Each objective should be concrete and actionable (e.g. "Present Fortimel Protein range and secure a trial order of 4-pack"). Return only valid JSON, no markdown.
Example: ["Objective 1", "Objective 2", "Objective 3"]`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    return JSON.parse(extractJson(textBlock.text)) as string[];
  } catch {
    return [];
  }
}

// ─── Objectives evaluation ───────────────────────────────────────────────────

export type ObjectiveEvaluation = {
  objective: string;
  status: "met" | "partial" | "not_met";
  evidence: string;
};

export type ObjectivesEvaluationResult = {
  evaluations: ObjectiveEvaluation[];
  overallAssessment: string;
  score: number; // 0-10
};

export async function evaluateVisitObjectives(params: {
  objectives: string[];
  notes: string | null;
  voiceSummary: VoiceSummaryResult | null;
  shelfAnalysis: ShelfAnalysisResult | null;
  orderPlaced: boolean;
  orderTotal: number | null;
}): Promise<ObjectivesEvaluationResult> {
  if (params.objectives.length === 0) {
    return {
      evaluations: [],
      overallAssessment: "No objectives were set for this visit.",
      score: 5,
    };
  }

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a field sales manager for Danone evaluating a rep's visit. Based on the visit data, assess whether each objective was met.

Visit objectives:
${params.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Visit outcomes:
- Notes: ${params.notes ?? "none"}
- Voice summary: ${params.voiceSummary?.summary ?? "not recorded"}
- Key points: ${params.voiceSummary?.keyPoints.join("; ") ?? "none"}
- Actions logged: ${params.voiceSummary?.actions.join("; ") ?? "none"}
- Shelf analysis: ${params.shelfAnalysis?.summary ?? "not performed"}
- Shelf score: ${params.shelfAnalysis ? `${params.shelfAnalysis.overallScore}/10` : "N/A"}
- Order placed: ${params.orderPlaced ? `Yes, €${params.orderTotal?.toFixed(2) ?? "unknown"}` : "No"}

For each objective, determine if it was met, partially met, or not met, and provide brief evidence from the visit data.

Return JSON only:
{
  "evaluations": [
    {
      "objective": "exact objective text",
      "status": "met" | "partial" | "not_met",
      "evidence": "brief explanation based on visit data"
    }
  ],
  "overallAssessment": "One sentence summary",
  "score": 7
}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from objectives evaluation");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as ObjectivesEvaluationResult;
  } catch {
    throw new Error("Failed to parse objectives evaluation");
  }
}

// ─── Next Best Actions ────────────────────────────────────────────────────────

export type NextBestAction = {
  type: "promo" | "bundle" | "animation" | "specialist_visit" | "product_intro" | "training";
  title: string;
  description: string;
  dueAt: string | null;
};

export interface NextBestActionsContext {
  pharmacyName: string;
  city: string;
  tier: string;
  segment: string | null;
  currentDate: string;
  season: string;
  lastVisitDate: string | null;
  daysSinceLastVisit: number | null;
  lastVisitNotes: string | null;
  shelfScore: number | null;
  shelfSummary: string | null;
  visitCount: number;
  previouslyAcceptedActions: string[];
  specialistVisitNeeded: boolean;
  // Hospital-specific
  accountType: string;
  doctorNotes: string | null;
  mainSpecialty: string | null;
  secondarySpecialty: string | null;
  peerOrders: { accountName: string; products: string[] }[];
}

export async function generateNextBestActions(
  context: NextBestActionsContext
): Promise<NextBestAction[]> {
  const isHospital = context.accountType === "hospital";

  const hospitalSection = isHospital ? `
Hospital/Doctor context:
- Account type: Hospital (PUI / medical prescriber)
- Doctor name & specialty: ${context.pharmacyName}
- Doctor clinical notes: ${context.doctorNotes ?? "none"}
- Main specialty: ${context.mainSpecialty ?? "not set"}
- Secondary specialty: ${context.secondarySpecialty ?? "not set"}
${context.peerOrders.length > 0 ? `- Peer hospitals with same specialty and their typical orders:\n${context.peerOrders.map(p => `    • ${p.accountName}: ${p.products.join(", ")}`).join("\n")}` : ""}

Key Danone Nutricia products by specialty (use these to suggest concrete products):
- enteral_nutrition: Nutrison Energy, Nutrison Protein Intense, Nutrison Multi Fibre, Nutrison Peptisorb, PreOp
- medical_nutrition: Fortimel Compact Protein, Fortimel Protein Sensation, Fortimel Crème 2kcal, Cubitan, Fortimel DiaCare
- oncology: Fortimel Compact Protein, Fortimel Protein Sensation, Fortimel PlantBased, PreOp (RAAC)
- geriatrics: Fortimel Crème 2kcal, Fortimel Protein, Nutilis Complete, Nutilis Aqua
- dysphagia: Nutilis Complete, Nutilis Aqua, Nutilis Powder, Nutilis Fruit
- nephrology: Renilon 7.5, Renilon 4.0, Nepro HP
- metabolic_diseases: PKU Anamix, MSUD Anamix, HCU Anamix, KetoCal 4:1, KetoCal 3:1, GMPro, Loprofin, Galactomin 19
- pediatrics: Infatrini, Nutrini, Nutrini Energy, Pepticate, Neocate LCP, KetoCal LQ Multi Fibre
- infant_formula: Aptamil Profutura, Gallia Calisma, Gallia Pepticate, Neocate LCP, Infatrini
- home_care: Nutrison (full range), Fortimel (full range), Nutilis (full range)

Hospital-specific action guidance:
- Focus on clinical adoption, formulary inclusion, and prescribing habits — NOT shelf display
- "specialist_visit" = schedule a Danone médecin conseil or diététicien expert to present clinical data
- "product_intro" = introduce a specific product relevant to this doctor's specialty with clinical evidence
- "training" = clinical training session or lunch-and-learn on Danone Nutricia products for the medical team
- "animation" = departmental awareness event, poster, or scientific symposium invitation
- "bundle" = combined prescription protocol (e.g. PreOp + post-op Nutrison for surgical pathways)
- "promo" is NOT relevant for hospital/PUI accounts — do not suggest it
` : "";

  const prompt = `You are a field sales intelligence assistant for Danone. Generate 3-5 next best actions for a ${isHospital ? "hospital medical sales rep visiting a prescribing doctor" : "pharmacy sales rep"}.

Account context:
- Account: ${context.pharmacyName}, ${context.city}
- Account type: ${isHospital ? "Hospital / Medical prescriber" : "Retail pharmacy"}
- Tier: ${context.tier}
- Segment: ${context.segment ?? "general"}
- Date: ${context.currentDate} (${context.season} season)
- Last visit: ${context.lastVisitDate ?? "never"}${context.daysSinceLastVisit !== null ? ` (${context.daysSinceLastVisit} days ago)` : ""}
- Last visit notes: ${context.lastVisitNotes ?? "none"}
${!isHospital ? `- Shelf score: ${context.shelfScore !== null ? `${context.shelfScore}/10` : "not assessed"}
- Shelf summary: ${context.shelfSummary ?? "not available"}` : ""}
- Total visits: ${context.visitCount}
- Previously accepted actions (do not repeat): ${context.previouslyAcceptedActions.join("; ") || "none"}
${context.specialistVisitNeeded ? "- IMPORTANT: A specialist/expert visit is strongly recommended" : ""}
${hospitalSection}
Available action types:
- "specialist_visit": Schedule a visit from a Danone expert (médecin conseil, diététicien clinique)
- "product_intro": Introduce a specific Danone product with clinical or commercial evidence
- "training": Clinical training / lunch-and-learn for the medical or pharmacy team
- "animation": Departmental event, scientific symposium, or awareness campaign
- "bundle": Multi-product prescription protocol or combined ordering pathway
${!isHospital ? `- "promo": Promotional offer (seasonal campaigns, volume discounts)` : ""}

Instructions:
${isHospital ? `1. Ground every action in the doctor's specialty (${context.mainSpecialty ?? "general"}) and their clinical notes
2. Reference specific Danone Nutricia products suited to this doctor's patient population
3. If peer hospitals with same specialty order products this doctor hasn't tried, suggest introducing those
4. Tier A & B doctors = strategic relationship actions (KOL events, symposia, clinical studies); Tier C = development
5. Never suggest promo or shelf-display actions for hospital accounts
6. If dueAt is relevant, suggest a date within the next 30-60 days in ISO format (YYYY-MM-DD), otherwise null
${context.specialistVisitNeeded ? "7. MUST include at least one specialist_visit action" : ""}` : `1. Prioritise actions relevant to the ${context.season} season (spring = baby formula, Evian/Volvic; summer = hydration; autumn = medical nutrition; winter = immune support)
2. Segment A & B = strategic actions; Seg C = development; Seg D = digital-only
3. If shelf score is below 6 or not assessed, prioritise a specialist_visit
4. Suggest concrete, named Danone products where relevant
5. If dueAt is relevant, suggest a date within the next 30-60 days in ISO format (YYYY-MM-DD), otherwise null
${context.specialistVisitNeeded ? "6. MUST include at least one specialist_visit action" : ""}`}

Return a JSON array only — no markdown, no explanation:
[
  {
    "type": "product_intro",
    "title": "Présentation Nutrison Peptisorb — protocole MICI",
    "description": "Proposer Nutrison Peptisorb pour les patients MICI en poussée. Apporter données cliniques et étude comparative vs concurrents. Objectif : inclusion au formulaire du service.",
    "dueAt": "2026-05-15"
  }
]`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from actions generation");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as NextBestAction[];
  } catch {
    throw new Error("Failed to parse next best actions");
  }
}

// ─── Perfect Store shelf analysis ────────────────────────────────────────────

export type PerfectStoreKpis = {
  shareOfShelf: number | null;        // 0-100 %
  extraDisplay: number | null;        // count of secondary display locations
  coreOnShelfAvailability: number | null; // 0-100 %
  numberOfFacings: number | null;     // total facings visible
  qualityOfPositioning: number | null; // 1-10 score
  shareOfAssortment: number | null;   // 0-100 %
};

export type PerfectStoreAnalysisResult = {
  // Inherited from standard shelf analysis
  stockouts: string[];
  lowStock: string[];
  competitorPresence: string[];
  planogramIssues: string[];
  recommendations: string[];
  overallScore: number; // 1-10
  summary: string;
  // Perfect Store specific
  kpis: PerfectStoreKpis;
  checklistSuggestions: string[]; // sub-item IDs from checklist.ts the AI believes are satisfied
};

export async function analyzePerfectStoreShelf(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  shelfSection: "main" | "brand" | "solar" | "deodorant",
  pharmacyContext: { name: string; tier: string; segment: string | null }
): Promise<PerfectStoreAnalysisResult> {
  const sectionLabel = {
    main: "Main/Integrated shelf",
    brand: "Brand-dedicated shelf",
    solar: "Solar/Sun care shelf",
    deodorant: "Deodorant shelf",
  }[shelfSection];

  // Sub-item IDs that are relevant to this section for AI to suggest
  const relevantSubItemIds = {
    main: [
      "item_1_lipikar","item_1_effaclar","item_1_cerave","item_1_vichy",
      "item_2_share60","item_2_eyelevel","item_2_blocking","item_2_tn",
      "item_7_2m","item_8_pos2","item_8_price",
    ],
    brand: [
      "item_1_lipikar","item_1_effaclar","item_1_cerave","item_1_vichy",
      "item_2_b_larger","item_2_b_atpar","item_2_b_smaller","item_2_b_noshelf",
      "item_2_share60","item_2_eyelevel","item_2_blocking","item_2_tn",
    ],
    solar: [
      "item_2_s_share60","item_2_s_eyelevel","item_2_s_blocking","item_2_s_tn",
      "item_3_topseller","item_3_crosscat","item_3_nocompetition",
      "item_4_topseller","item_4_crosscat","item_4_nocompetition",
      "item_5_topseller","item_5_crosscat","item_5_nocompetition",
    ],
    deodorant: [
      "item_2_d_share60","item_2_d_eyelevel","item_2_d_blocking","item_2_d_tn",
      "item_3_topseller","item_3_crosscat","item_3_nocompetition",
      "item_4_topseller","item_4_crosscat","item_4_nocompetition",
      "item_5_topseller","item_5_crosscat","item_5_nocompetition",
    ],
  }[shelfSection];

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBase64 },
          },
          {
            type: "text",
            text: `Analyze this Danone Perfect Store audit photo.
Pharmacy: ${pharmacyContext.name} (Segment ${pharmacyContext.tier?.toUpperCase()}, ${pharmacyContext.segment ?? "general"})
Shelf section: ${sectionLabel}

Core Danone products to track: Fortimel Protein 200ml, Fortimel Energy 200ml, Gallia Calisma 1er âge, Aptamil Pronutra 1, Blédina compotes, Evian bébé.
Brands: Nutricia, Gallia, Aptamil, Blédina, Evian, Volvic.

Return a JSON object with exactly this structure:
{
  "stockouts": ["product names with zero stock visible"],
  "lowStock": ["product names with only 1-2 units visible"],
  "competitorPresence": ["competitor brand names visible"],
  "planogramIssues": ["specific planogram or display problems observed"],
  "recommendations": ["concrete actionable recommendations"],
  "overallScore": 7,
  "summary": "2-3 sentence assessment of this shelf section",
  "kpis": {
    "shareOfShelf": 65,
    "extraDisplay": 1,
    "coreOnShelfAvailability": 80,
    "numberOfFacings": 12,
    "qualityOfPositioning": 7,
    "shareOfAssortment": 70
  },
  "checklistSuggestions": ["item_2_share60", "item_2_eyelevel"]
}

KPI definitions:
- shareOfShelf: % of visible shelf space occupied by Danone brands (0-100), null if not assessable
- extraDisplay: number of secondary/additional display locations visible for Danone (integer), null if none
- coreOnShelfAvailability: % of core SKUs (listed above) present and stocked (0-100), null if not assessable
- numberOfFacings: total number of Danone facings visible (integer), null if not assessable
- qualityOfPositioning: overall quality score 1-10 (eye level, visibility, grouping), null if not assessable
- shareOfAssortment: % of Danone SKUs visible vs total category SKUs on shelf (0-100), null if not assessable

checklistSuggestions: list ONLY the sub-item IDs from this list that appear to be satisfied based on what you can see:
${relevantSubItemIds.join(", ")}

Return only valid JSON, no markdown.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Perfect Store shelf analysis");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as PerfectStoreAnalysisResult;
  } catch (e) {
    console.error("[ps-shelf] Parse failed. Raw:", textBlock.text.slice(0, 800));
    throw new Error(`Failed to parse Perfect Store shelf analysis: ${(e as Error).message}`);
  }
}

// ─── Store Layout Analysis ────────────────────────────────────────────────────

export type StoreZone = {
  id: string;
  type: "shelf" | "counter" | "entrance" | "gondola" | "end_cap" | "window" | "alley" | "display";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  currentContent: string;
  picosStatus: "ideal" | "needs_work" | "missing" | "neutral";
  picosPlacement: string | null;
  priority: "high" | "medium" | "low" | "none";
};

export type StoreLayoutAnalysis = {
  zones: StoreZone[];
  storeSummary: string;
  keyActions: Array<{ text: string; zoneId: string | null }>;
};

export async function analyzeStoreLayout(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  pharmacyContext: { name: string; tier: string; segment: string | null }
): Promise<StoreLayoutAnalysis> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBase64 },
          },
          {
            type: "text",
            text: `You are a retail merchandising AI for Danone field reps. Analyze this pharmacy interior photo and extract a schematic floor plan viewed from above.

Pharmacy: ${pharmacyContext.name} (Tier ${pharmacyContext.tier.toUpperCase()}, ${pharmacyContext.segment ?? "general"} segment)

Identify every distinct physical zone visible — shelving runs, counters, entrance/exit, gondolas (free-standing double-sided shelves), end-caps (shelf-end displays), windows, alleys, and display fixtures.

For each zone:
1. Estimate normalized coordinates (x, y, w, h) on a 0–100 scale as if viewing from directly above. x/y = top-left corner. The entrance should be near the bottom (y ≈ 80–90). The back of the store should be near the top (y ≈ 0–20).
2. Note what Danone brands or competitor products are currently visible (or "unknown" if unclear).
3. Assess PICOS compliance:
   - "ideal": Danone products correctly placed, full share of shelf, good visibility
   - "needs_work": Danone present but misplaced, insufficient share, or competitor-dominated
   - "missing": Zone should have Danone products per PICOS but none visible
   - "neutral": Zone not relevant for Danone PICOS placement (alley, entrance, restroom)
4. If "needs_work" or "missing", write a specific actionable PICOS recommendation for the rep.
5. Assign priority: "high" (immediate revenue/visibility impact), "medium", "low", or "none".

Danone PICOS rules to apply:
- Medical nutrition shelf (Nutricia): Danone must occupy ≥60% share; Fortimel Protein & Energy at eye-level (1.2–1.5m); apply horizontal brand blocking
- Infant formula shelf (Gallia/Aptamil): Danone section must be ≥ competitor section; Gallia Calisma & Aptamil Pronutra at eye-level
- Counter/checkout: Fortimel display unit within reach of checkout, with price tags and promo
- Gondola end-caps: 100% Danone top sellers only — no competitor sharing
- Core SKUs to track: Fortimel Protein 200ml, Fortimel Energy 200ml, Gallia Calisma 1er âge, Aptamil Pronutra 1, Blédina compotes, Evian bébé

Identify 3–5 key PICOS actions the rep must take today, ordered by priority.

Return ONLY a valid JSON object — no markdown, no prose:
{
  "zones": [
    {
      "id": "zone_1",
      "type": "shelf",
      "label": "Rayon Nutrition Médicale",
      "x": 5, "y": 10, "w": 55, "h": 12,
      "currentContent": "Fortimel visible, concurrents sur rangée eye-level",
      "picosStatus": "needs_work",
      "picosPlacement": "Repositionner Fortimel Protein à la rangée eye-level (2-3). Appliquer la règle des 60% de part de rayon.",
      "priority": "high"
    }
  ],
  "storeSummary": "2-3 sentence description of the pharmacy layout and overall PICOS compliance level.",
  "keyActions": [
    { "text": "Revendiquer 60% du rayon nutrition médicale avec bloquage horizontal Danone", "zoneId": "zone_1" },
    { "text": "Installer un display Fortimel au comptoir caisse", "zoneId": "counter_1" }
  ]
}`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from store layout analysis");
  }

  try {
    return JSON.parse(extractJson(textBlock.text)) as StoreLayoutAnalysis;
  } catch (e) {
    console.error("[store-layout] Parse failed. Raw:", textBlock.text.slice(0, 800));
    throw new Error(`Failed to parse store layout analysis: ${(e as Error).message}`);
  }
}
