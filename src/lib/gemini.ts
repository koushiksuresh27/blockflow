// src/lib/gemini.ts

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ComplaintSuggestion {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
}

const VALID_CATEGORIES = [
  'Plumbing', 'Electrical', 'Carpentry', 'Housekeeping',
  'Security', 'Lift', 'Intercom', 'Pest Control', 'Other',
];

export async function suggestComplaintDetails(
  transcriptText: string
): Promise<ComplaintSuggestion> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY is not set in .env.local');
  }

  if (!transcriptText?.trim()) {
    throw new Error('No transcript text provided');
  }

  const prompt = `You are a maintenance complaint classifier for an Indian housing society app.

Given the complaint description below, return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Complaint: "${transcriptText}"

Categories available: ${VALID_CATEGORIES.join(', ')}
Priority levels: low, medium, high, urgent

Rules:
- urgent = water flooding, power outage, security breach, lift stuck with people
- high = leaking tap/pipe, broken lock, electrical sparks
- medium = slow drain, flickering light, minor damage
- low = cosmetic issues, suggestions, general requests

Respond with exactly this JSON:
{"category": "<one of the categories>", "priority": "<low|medium|high|urgent>", "confidence": <0.0 to 1.0>}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API failed: HTTP ${response.status} — ${err}`);
  }

  const data = await response.json();
  const rawText: string = data?.choices?.[0]?.message?.content ?? '';

  // Strip markdown fences just in case
  const clean = rawText.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean) as ComplaintSuggestion;

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = 'Other';
    }

    return parsed;
  } catch {
    console.error('Groq returned non-JSON:', rawText);
    return { category: 'Other', priority: 'medium', confidence: 0 };
  }
}