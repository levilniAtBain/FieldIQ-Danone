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
- Tier: ${context.tier} account
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

Products frequently ordered by nearby pharmacies (peer data):
${context.peerSuggestions.length > 0
  ? context.peerSuggestions.map((p) => `  ${p.sku} ${p.name}: avg ${p.peerAvgQty} units`).join("\n")
  : "  No peer data"}

Instructions:
1. Start from the previous order as the baseline
2. Prioritize replenishing any stockouts or low-stock products identified in shelf photos
3. Apply any adjustments mentioned in scanned notes or voice (e.g. "add 2 more CeraVe", "skip Vichy this time")
4. Consider peer suggestions for products not in the last order
5. Only include SKUs from the available products list
6. Provide a brief rationale for each line, noting when driven by shelf analysis

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
    max_tokens: 1200,
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
- Tier: ${context.tier} account
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
