// src/lib/gemini.ts

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ComplaintSuggestion {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  title_en: string;
  description_en: string;
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

Translate the complaint into an English title and English description (if it is already English, just return it as-is).

Respond with exactly this JSON:
{"category": "<one of the categories>", "priority": "<low|medium|high|urgent>", "confidence": <0.0 to 1.0>, "title_en": "<translated title>", "description_en": "<translated description>"}`;

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
    return { category: 'Other', priority: 'medium', confidence: 0, title_en: '', description_en: '' };
  }
}

export interface BriefingData {
  totalComplaints: number;
  pendingComplaints: number;
  solvedComplaints: number;
  slaBreaches: number;
  topCategory: string;
  totalTechnicians: number;
  availableTechnicians: number;
  overdueMaintenances: number;
  activeAlerts: number;
  societyName: string;
  expiringVendors: number;
  totalVendors: number;
}

export async function generateDailyBriefing(
  data: BriefingData
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY is not set in .env.local');
  }

  const prompt = `You are an AI assistant for ${data.societyName}, 
an Indian residential housing society. 
Generate a concise, professional daily operations 
briefing for the Estate Manager.

Today's data:
- Total complaints: ${data.totalComplaints}
- Pending complaints: ${data.pendingComplaints}
- Resolved complaints: ${data.solvedComplaints}
- SLA breaches today: ${data.slaBreaches}
- Most reported issue: ${data.topCategory}
- Technicians on roster: ${data.totalTechnicians}
- Available right now: ${data.availableTechnicians}
- Overdue maintenance tasks: ${data.overdueMaintenances}
- Active alerts sent: ${data.activeAlerts}
- Active vendors: ${data.totalVendors}
- Contracts expiring in 30 days: ${data.expiringVendors}

Write the briefing in this exact format:
1. Start with a one-line overall status 
   (Good / Needs Attention / Critical) 
2. Then 3-5 short bullet points with specific 
   observations and recommended actions
3. End with one line: what the estate manager 
   should focus on today

Keep it under 120 words. Be direct. 
No greetings, no sign-off.
If contracts are expiring soon, mention it as a priority action.`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API failed: HTTP ${response.status} — ${err}`);
  }

  const result = await response.json();
  const rawText: string = result?.choices?.[0]?.message?.content ?? '';

  return rawText.trim();
}