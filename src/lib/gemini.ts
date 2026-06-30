const WORKFLOW_URL = 
  import.meta.env.VITE_WORKFLOW_URL || 
  'http://localhost:3001'

export interface ComplaintSuggestion {
  category: string
  priority: string
  confidence: number
}

export async function analyzeComplaint(
  transcript: string
): Promise<ComplaintSuggestion> {
  const response = await fetch(
    `${WORKFLOW_URL}/ai/suggest`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcript })
    }
  )

  if (!response.ok) {
    throw new Error(
      'AI suggestion failed: ' + 
      response.status
    )
  }

  const data = await response.json()
  return {
    category: data.category || 'General',
    priority: data.priority || 'medium',
    confidence: Math.min(
      Math.round(data.confidence || 50), 
      100
    )
  }
}

export async function generateDailyBriefing(
  context: Record<string, unknown>
): Promise<string> {
  const response = await fetch(
    `${WORKFLOW_URL}/agent/briefing`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        society_id: 
          import.meta.env.VITE_SOCIETY_ID,
        context 
      })
    }
  )

  if (!response.ok) {
    return 'Unable to generate briefing.'
  }

  const data = await response.json()
  return data.briefing || 
    'No briefing available.'
}

export const suggestComplaintDetails = 
  analyzeComplaint