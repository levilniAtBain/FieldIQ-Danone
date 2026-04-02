/**
 * Quick diagnostic: calls Claude shelf analysis with a 1x1 white PNG
 * and prints the raw response to see what format Claude uses.
 *
 * Run: docker-compose exec app npx tsx scripts/test-shelf-analysis.ts
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Minimal valid 1×1 white PNG in base64
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

async function main() {
  console.log("Calling Claude with test image...\n");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: TINY_PNG },
          },
          {
            type: "text",
            text: `Analyze this pharmacy shelf photo for Test Pharmacy (gold tier).
Focus on L'Oréal brands: Vichy, CeraVe, La Roche-Posay, SkinCeuticals.

Return a JSON object with this exact structure:
{
  "stockouts": [],
  "lowStock": [],
  "competitorPresence": [],
  "planogramIssues": [],
  "recommendations": [],
  "overallScore": 5,
  "summary": "brief summary"
}

Return only valid JSON, no markdown.`,
          },
        ],
      },
    ],
  });

  console.log("=== Full response.content ===");
  for (const block of response.content) {
    if (block.type === "thinking") {
      console.log(`[thinking block — ${block.thinking.length} chars]`);
    } else if (block.type === "text") {
      console.log("[text block]:", JSON.stringify(block.text));
    } else {
      console.log("[other block]:", block.type);
    }
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (textBlock && textBlock.type === "text") {
    console.log("\n=== Raw text ===");
    console.log(textBlock.text);

    console.log("\n=== Can parse JSON? ===");
    try {
      // Replicate extractJson logic
      const stripped = textBlock.text
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const extracted = stripped.slice(start, end + 1);
        const parsed = JSON.parse(extracted);
        console.log("SUCCESS:", JSON.stringify(parsed, null, 2));
      } else {
        console.log("No JSON object found in text");
      }
    } catch (e) {
      console.log("FAILED:", e);
    }
  }
}

main().catch(console.error);
