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
  const prompt = `You are a field sales intelligence assistant for L'Oréal. Generate a concise pre-visit briefing for the following pharmacy account.

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
3. Recommended L'Oréal products or promotions to discuss (Vichy, CeraVe, La Roche-Posay, SkinCeuticals, etc.)
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

Focus on L'Oréal brands: Vichy, CeraVe, La Roche-Posay, SkinCeuticals, SkinBetter, Mixa, NYX, Biotherm, Medik8.

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
          content: `Match each pharmacy product to the closest L'Oréal catalog entry. These are French pharmacy system exports (Winpharma/LGPI) — product names may be truncated or abbreviated.

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

  const shelfContext = context.shelfAnalyses.length > 0
    ? context.shelfAnalyses.map((a, i) => {
        const parts = [`Shelf photo ${i + 1} (score ${a.overallScore}/10): ${a.summary}`];
        if (a.stockouts.length) parts.push(`  Stockouts: ${a.stockouts.join(", ")}`);
        if (a.lowStock.length) parts.push(`  Low stock: ${a.lowStock.join(", ")}`);
        if (a.recommendations.length) parts.push(`  AI recommendations: ${a.recommendations.join("; ")}`);
        return parts.join("\n");
      }).join("\n\n")
    : "  No shelf photos taken";

  const prompt = `You are a field sales assistant for L'Oréal. Build a pharmacy replenishment order for ${context.pharmacyName}.

Available products (SKU — Name — Brand):
${skuList}

Last order from this pharmacy:
${context.lastOrderLines.length > 0
  ? context.lastOrderLines.map((l) => `  ${l.sku} ${l.name}: ${l.quantity} units`).join("\n")
  : "  No previous order on record"}

Shelf analysis from this visit (use to replenish stockouts and low stock):
${shelfContext}

Scanned/typed notes from this visit (may reference products or quantities):
${context.scannedOrderItems.length > 0
  ? context.scannedOrderItems.map((i) => `  ${i.sku ?? "?"} ${i.productName}: ${i.quantity}`).join("\n")
  : "  None"}

Voice notes from this visit:
${context.voiceTranscript ?? "None"}

Sell-out data (what this pharmacy sold since last visit):
${context.sellOutData && context.sellOutData.length > 0
  ? context.sellOutData.map((s) => `  ${s.sku} ${s.name}: ${s.qtySold} unités vendues${s.periodLabel ? ` (${s.periodLabel})` : ""}`).join("\n")
  : "  Non disponible"}

Stock actuel (inventaire en pharmacie):
${context.stockData && context.stockData.length > 0
  ? context.stockData.map((s) => `  ${s.sku} ${s.name}: ${s.qtyInStock} unités en stock`).join("\n")
  : "  Non disponible"}

Products frequently ordered by nearby pharmacies (peer data):
${context.peerSuggestions.length > 0
  ? context.peerSuggestions.map((p) => `  ${p.sku} ${p.name}: avg ${p.peerAvgQty} units`).join("\n")
  : "  No peer data"}

Instructions:
1. Start from the previous order as the baseline
2. Prioritize replenishing any stockouts or low-stock products identified in shelf photos
3. If sell-out data is available, use it as the primary signal for replenishment quantities:
   - High sell-out + low/zero stock → urgent replenishment, quantity ≥ sell-out volume
   - High sell-out + adequate stock → small top-up only
   - Low/zero sell-out + high stock → skip or reduce significantly
   - Product in sell-out but absent from stock → likely stockout, high priority
4. Apply any adjustments mentioned in scanned notes or voice (e.g. "add 2 more CeraVe", "skip Vichy this time")
5. Consider peer suggestions for products not covered by sell-out or history
6. Only include SKUs from the available products list
7. Provide a brief rationale for each line, noting when driven by sell-out/stock data

Return JSON only — no markdown:
{
  "lines": [
    { "sku": "CER-001", "quantity": 6, "rationale": "same as last order", "source": "history" },
    { "sku": "LRP-001", "quantity": 3, "rationale": "added per voice note request", "source": "voice" }
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
  const prompt = `You are a field sales assistant for L'Oréal. Generate a professional visit report for Salesforce.

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
        content: `You are a field sales intelligence assistant for L'Oréal. Based on this pharmacy account, suggest 3-5 concrete visit objectives for the sales rep.

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

Return a JSON array of objective strings. Each objective should be concrete and actionable (e.g. "Present CeraVe Hydrating Cleanser and secure a trial order"). Return only valid JSON, no markdown.
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
        content: `You are a field sales manager for L'Oréal evaluating a rep's visit. Based on the visit data, assess whether each objective was met.

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
}

export async function generateNextBestActions(
  context: NextBestActionsContext
): Promise<NextBestAction[]> {
  const prompt = `You are a field sales intelligence assistant for L'Oréal. Generate 3-5 next best actions for a pharmacy sales rep.

Account context:
- Pharmacy: ${context.pharmacyName}, ${context.city}
- Tier: ${context.tier}
- Segment: ${context.segment ?? "general"}
- Date: ${context.currentDate} (${context.season} season)
- Last visit: ${context.lastVisitDate ?? "never"}${context.daysSinceLastVisit !== null ? ` (${context.daysSinceLastVisit} days ago)` : ""}
- Last visit notes: ${context.lastVisitNotes ?? "none"}
- Shelf score: ${context.shelfScore !== null ? `${context.shelfScore}/10` : "not assessed"}
- Shelf summary: ${context.shelfSummary ?? "not available"}
- Total visits: ${context.visitCount}
- Previously accepted actions (do not repeat): ${context.previouslyAcceptedActions.join("; ") || "none"}
${context.specialistVisitNeeded ? "- IMPORTANT: A specialist visit is strongly recommended (shelf score below 6 or >60 days since last visit or never visited)" : ""}

Available action types:
- "promo": Promotional offer to present (seasonal campaigns, volume discounts)
- "bundle": Bundle deal proposal (multi-product packaging)
- "animation": In-store animation or display event
- "specialist_visit": Schedule a visit from an L'Oréal product specialist (MV — Visiteur Médical) to support the pharmacy team with product expertise and shelf assessment
- "product_intro": Introduce a new L'Oréal product range (Vichy, CeraVe, La Roche-Posay, SkinCeuticals, SkinBetter, Mixa, NYX, Biotherm, Medik8)
- "training": Training session for pharmacy staff on product knowledge

Instructions:
1. Prioritise actions relevant to the ${context.season} season (spring = sun care, skin renewal; summer = sun protection; autumn = hydration, repair; winter = rich moisturisers, lip care)
2. Segment A & B accounts should receive higher-value, more strategic actions; Seg C focuses on development; Seg D digital-only
3. If shelf score is below 6 or not assessed, prioritise a specialist_visit action
4. Suggest concrete, named L'Oréal products where relevant
5. If dueAt is relevant, suggest a date within the next 30-60 days in ISO format (YYYY-MM-DD), otherwise null
${context.specialistVisitNeeded ? "6. MUST include at least one specialist_visit action" : ""}

Return a JSON array only — no markdown, no explanation:
[
  {
    "type": "promo",
    "title": "Spring Sun Care Launch — Vichy Capital Soleil",
    "description": "Present the new Vichy Capital Soleil UV-Age Daily SPF50+ ahead of summer. Pharmacy eligible for 15% launch discount on first order of 12+ units.",
    "dueAt": "2026-04-30"
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
            text: `Analyze this L'Oréal Perfect Store audit photo.
Pharmacy: ${pharmacyContext.name} (Segment ${pharmacyContext.tier?.toUpperCase()}, ${pharmacyContext.segment ?? "general"})
Shelf section: ${sectionLabel}

Core L'Oréal products to track: Lipikar AP+M (La Roche-Posay), Effaclar Duo+M (La Roche-Posay), CeraVe Lait Hydratant, Vichy Lifactiv, Anthelios/UV Mune (La Roche-Posay), Vichy Minéral 89.
Brands: La Roche-Posay, CeraVe, Vichy, SkinCeuticals, SkinBetter, Mixa.

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
- shareOfShelf: % of visible shelf space occupied by L'Oréal brands (0-100), null if not assessable
- extraDisplay: number of secondary/additional display locations visible for L'Oréal (integer), null if none
- coreOnShelfAvailability: % of core SKUs (listed above) present and stocked (0-100), null if not assessable
- numberOfFacings: total number of L'Oréal facings visible (integer), null if not assessable
- qualityOfPositioning: overall quality score 1-10 (eye level, visibility, grouping), null if not assessable
- shareOfAssortment: % of L'Oréal SKUs visible vs total dermocosmetic SKUs on shelf (0-100), null if not assessable

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
