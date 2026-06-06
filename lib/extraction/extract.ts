import OpenAI from "openai";
import { z } from "zod";

export const ExtractedItemSchema = z.object({
  type: z.enum(["fact", "decision", "risk", "action_item", "milestone"]),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  entities: z.array(z.string()),
});

const ExtractionBatchSchema = z.object({ items: z.array(ExtractedItemSchema) });
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export async function extractInsightsFromEvent(
  apiKey: string,
  modelName: string,
  eventBody: string,
): Promise<ExtractedItem[]> {
  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  const prompt = `You are an organizational intelligence extraction agent. Analyze the following corporate event and extract any key facts, operational decisions, risks, blockers, action items, or milestones.

Raw Event:
"""
${eventBody}
"""

Instructions:
1. Extract items only if they represent real operational signals.
2. Ignore social chatter, greetings, and generic acknowledgments.
3. For each extracted item, provide content, type, confidence, and entities.
4. Output a valid JSON object: {"items":[{"type":"fact|decision|risk|action_item|milestone","content":"string","confidence":0.9,"entities":["string"]}]}`;

  try {
    const response = await openai.chat.completions.create({
      model: modelName || "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content;
    if (!text) return [];
    return ExtractionBatchSchema.parse(JSON.parse(text)).items;
  } catch (error) {
    console.error("OpenAI/Gemini extraction failed:", error);
    return [];
  }
}
