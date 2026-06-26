require('dotenv').config({ path: '.env.local' })

const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')

const groqClients = [
  new Groq({ apiKey: process.env.GROQ_API_KEY_1 }),
  new Groq({ apiKey: process.env.GROQ_API_KEY_2 }),
]
let groqIndex = 0

async function callLLM(messages, options = {}, maxTokens = 1000, model = 'llama-3.3-70b-versatile') {
  const attempts = groqClients.length
  for (let i = 0; i < attempts; i++) {
    const client = groqClients[groqIndex % groqClients.length]
    groqIndex++
    try {
      const params = {
        model,
        messages,
        max_tokens: maxTokens,
      }
      // Support both legacy array style and new options-object style
      const toolsArray = Array.isArray(options) ? options : options?.tools
      if (Array.isArray(toolsArray) && toolsArray.length > 0) {
        params.tools = toolsArray
        params.tool_choice = options?.tool_choice ?? 'auto'
        if (options?.parallel_tool_calls !== undefined) {
          params.parallel_tool_calls = options.parallel_tool_calls
        }
      }
      if (options?.temperature !== undefined) {
        params.temperature = options.temperature
      }
      return await client.chat.completions.create(params)
    } catch (err) {
      if (err?.status === 429) {
        console.log(`Groq key ${i + 1} rate limited, trying next...`)
        continue
      }
      throw err
    }
  }
  throw new Error('All Groq keys rate limited. Wait 1 minute.')
}

const app = express()
app.use(cors())
app.use(express.json())

// ΓöÇΓöÇΓöÇ Supabase & Groq Clients ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY
)

// Service-role client ΓÇö bypasses RLS for privileged server-side queries
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ΓöÇΓöÇΓöÇ WhatsApp Helper Function ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async function sendWhatsAppNotification({
  technicianPhone,
  technicianName,
  complaintTitle,
  complaintDescription,
  flatLocation,
  priority,
  slaDeadline
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[WhatsApp] Missing Twilio env variables')
    return null
  }

  const priorityEmoji = {
    critical: '≡ƒÜ¿',
    high: '≡ƒö┤',
    medium: '≡ƒƒí',
    low: '≡ƒƒó'
  }

  const emoji = priorityEmoji[priority?.toLowerCase()] ?? 'ΓÜ¬'

  const messageBody = [
    `≡ƒöº *New Task Assigned ΓÇö BlockFlow*`,
    ``,
    `*Complaint:* ${complaintTitle}`,
    `*Location:* ${flatLocation}`,
    `*Priority:* ${emoji} ${priority}`,
    `*SLA Deadline:* ${slaDeadline}`,
    ``,
    `*Details:* ${complaintDescription}`,
    ``,
    `Please open the BlockFlow app to accept or decline.`
  ].join('\n')

  const credentials = Buffer.from(
    `${accountSid}:${authToken}`
  ).toString('base64')

  const formData = new URLSearchParams()
  formData.append('From', `whatsapp:${fromNumber}`)
  formData.append('To', `whatsapp:${technicianPhone}`)
  formData.append('Body', messageBody)

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    const twilioData = await twilioResponse.json()

    if (!twilioResponse.ok) {
      console.error('[WhatsApp] Twilio error:', twilioData)
      return null
    }

    console.log(
      `[WhatsApp] Sent to ${technicianName} (${technicianPhone}),` +
      ` SID: ${twilioData.sid}`
    )
    return twilioData.sid
  } catch (err) {
    console.error('[WhatsApp] Fetch error:', err)
    return null
  }
}

// ΓöÇΓöÇΓöÇ Complaint DNA Pipeline ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const SEVERITY_CONFIG = {
  lifeline: {
    assets: [
      'lift', 'elevator', 'generator',
      'dg', 'water pump', 'pump', 'stp',
      'sewage', 'borewell'
    ],
    threshold: 2,
    window_days: 30,
    severity: 'critical',
    estimated_repair_cost: 45000
  },
  security: {
    assets: [
      'cctv', 'camera', 'boom barrier',
      'intercom', 'access control',
      'security system', 'gate'
    ],
    threshold: 3,
    window_days: 30,
    severity: 'high',
    estimated_repair_cost: 15000
  },
  amenities: {
    assets: [
      'gym', 'pool', 'swimming',
      'clubhouse', 'ac', 'air conditioning',
      'hvac', 'common area'
    ],
    threshold: 4,
    window_days: 30,
    severity: 'medium',
    estimated_repair_cost: 8000
  },
  cosmetic: {
    assets: [
      'paint', 'light', 'bulb',
      'fixture', 'door', 'window',
      'tile', 'floor'
    ],
    threshold: 5,
    window_days: 60,
    severity: 'low',
    estimated_repair_cost: 2000
  }
}


async function generateFingerprint(complaint) {
  console.log(`[DNA-1] Generating fingerprint for complaint: ${complaint.id}`)

  try {
    const completion = await groqClients[0].chat.completions.create({
      model: 'llama-3.3-8b-instant',
      messages: [{
        role: 'system',
        content: `You are a maintenance complaint analyzer. Extract the core asset and fault from complaints. Return ONLY valid JSON.`
      }, {
        role: 'user',
        content: `Analyze this apartment maintenance complaint and extract:
        1. asset_type: the physical asset (e.g. "lift", "water pump", "generator", "gym ac", "cctv", "corridor light")
        2. fault_type: the type of failure (e.g. "not working", "leaking", "making noise", "door stuck", "power failure", "offline")
        3. location: specific location if mentioned (e.g. "Tower A", "basement", "terrace", "floor 3", null if not mentioned)
        4. fingerprint: combine asset and fault into a short standard code (e.g. "LIFT_DOOR_STUCK", "PUMP_NOT_WORKING", "CCTV_OFFLINE")

        Title: ${complaint.title}
        Description: ${complaint.description}
        Category: ${complaint.category}

        Return exactly:
        {
          "asset_type": "...",
          "fault_type": "...",
          "location": "..." or null,
          "fingerprint": "ASSET_FAULT_CODE"
        }`
      }],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(
      completion.choices[0].message.content
    )

    console.log(`[DNA-1] Fingerprint generated:`, result)
    return result

  } catch (err) {
    console.error(`[DNA-1] Fingerprint error:`, err)
    return {
      asset_type: complaint.category.toLowerCase(),
      fault_type: 'unspecified',
      location: null,
      fingerprint: complaint.category
        .toUpperCase()
        .replace(/\s+/g, '_') + '_ISSUE'
    }
  }
}


async function checkIncidentCluster(complaint, fingerprint) {
  console.log(
    `[DNA-2] Checking clusters for fingerprint: ${fingerprint.fingerprint}`
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: todayCluster } = await supabaseAdmin.from('incident_clusters')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .eq('cluster_date', today)
    .single()

  if (todayCluster) {
    const updatedIds = [
      ...todayCluster.complaint_ids,
      complaint.id
    ]

    await supabaseAdmin.from('incident_clusters')
      .update({
        complaint_ids: updatedIds,
        complaint_count: updatedIds.length
      })
      .eq('id', todayCluster.id)

    await supabaseAdmin.from('complaints')
      .update({
        incident_cluster_id: todayCluster.id,
        fingerprint: fingerprint.fingerprint
      })
      .eq('id', complaint.id)

    console.log(
      `[DNA-2] Concurrent incident ΓÇö added to cluster ${todayCluster.id}. ` +
      `Total today: ${updatedIds.length}`
    )

    return {
      is_new_cluster: false,
      cluster_id: todayCluster.id,
      is_concurrent: true
    }
  }

  const { data: newCluster } = await supabaseAdmin.from('incident_clusters')
    .insert({
      society_id: complaint.society_id,
      fingerprint: fingerprint.fingerprint,
      cluster_date: today,
      complaint_ids: [complaint.id],
      complaint_count: 1,
      is_single_incident: true
    })
    .select()
    .single()

  await supabaseAdmin.from('complaints')
    .update({
      incident_cluster_id: newCluster.id,
      fingerprint: fingerprint.fingerprint
    })
    .eq('id', complaint.id)

  console.log(`[DNA-2] New cluster created: ${newCluster.id}`)

  return {
    is_new_cluster: true,
    cluster_id: newCluster.id,
    is_concurrent: false
  }
}


async function detectPattern(complaint, fingerprint, clusterResult) {
  console.log(`[DNA-3] Detecting patterns for: ${fingerprint.fingerprint}`)

  const assetLower = fingerprint.asset_type.toLowerCase()
  let config = SEVERITY_CONFIG.cosmetic // default

  for (const [key, val] of Object.entries(SEVERITY_CONFIG)) {
    if (val.assets.some(a => assetLower.includes(a))) {
      config = val
      break
    }
  }

  console.log(
    `[DNA-3] Asset category: ${config.severity}, ` +
    `threshold: ${config.threshold}x in ${config.window_days} days`
  )

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - config.window_days)

  const { data: clusters } = await supabaseAdmin.from('incident_clusters')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .gte('cluster_date', windowStart.toISOString().split('T')[0])
    .order('cluster_date', { ascending: true })

  const distinctIncidents = clusters?.length || 0

  console.log(
    `[DNA-3] Found ${distinctIncidents} distinct incidents in last ` +
    `${config.window_days} days (threshold: ${config.threshold})`
  )

  return {
    distinct_incidents: distinctIncidents,
    threshold: config.threshold,
    severity: config.severity,
    window_days: config.window_days,
    estimated_cost: config.estimated_repair_cost,
    threshold_hit: distinctIncidents >= config.threshold,
    clusters
  }
}


async function createChronicIssue(
  complaint, fingerprint,
  patternResult, clusterResult
) {
  console.log(
    `[DNA-4] Creating chronic issue for: ${fingerprint.fingerprint}`
  )

  const { data: existing } = await supabaseAdmin.from('chronic_issues')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .eq('status', 'active')
    .single()

  let chronicIssue

  if (existing) {
    const { data: updated } = await supabaseAdmin.from('chronic_issues')
      .update({
        occurrence_count: patternResult.distinct_incidents,
        last_reported: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single()

    chronicIssue = updated
    console.log(`[DNA-4] Updated existing chronic issue: ${existing.id}`)
  } else {
    const firstCluster = patternResult.clusters[0]

    const { data: created } = await supabaseAdmin.from('chronic_issues')
      .insert({
        society_id: complaint.society_id,
        asset_type: fingerprint.asset_type,
        fault_type: fingerprint.fault_type,
        location: fingerprint.location,
        fingerprint: fingerprint.fingerprint,
        occurrence_count: patternResult.distinct_incidents,
        first_reported: firstCluster
          ? new Date(firstCluster.cluster_date).toISOString()
          : new Date().toISOString(),
        last_reported: new Date().toISOString(),
        status: 'active',
        severity: patternResult.severity,
        estimated_cost_saved: patternResult.estimated_cost
      })
      .select()
      .single()

    chronicIssue = created
    console.log(`[DNA-4] Created new chronic issue: ${created.id}`)
  }

  await supabaseAdmin.from('complaints')
    .update({
      is_chronic: true,
      chronic_issue_id: chronicIssue.id
    })
    .eq('id', complaint.id)

  const { data: rootTicket } = await supabaseAdmin.from('root_cause_tickets')
    .insert({
      chronic_issue_id: chronicIssue.id,
      society_id: complaint.society_id,
      title: `ROOT CAUSE: ${fingerprint.asset_type.toUpperCase()} ΓÇö ${fingerprint.fault_type.toUpperCase()}`,
      description:
        `This asset has failed ${patternResult.distinct_incidents} times ` +
        `in ${patternResult.window_days} days. ` +
        `Estimated cost saved by addressing root cause: ` +
        `Γé╣${patternResult.estimated_cost.toLocaleString('en-IN')}.\n\n` +
        `Recent complaints fingerprinted as: ${fingerprint.fingerprint}\n\n` +
        `Action required: Document root cause and implement permanent fix.`,
      status: 'open',
      amc_notified: false
    })
    .select()
    .single()

  console.log(`[DNA-4] Root cause ticket created: ${rootTicket.id}`)

  await supabaseAdmin.from('agent_context')
    .insert({
      society_id: complaint.society_id,
      context_type: 'chronic_issue',
      title: `Chronic Issue: ${fingerprint.asset_type} failing repeatedly`,
      data: {
        chronic_issue_id: chronicIssue.id,
        root_cause_ticket_id: rootTicket.id,
        asset_type: fingerprint.asset_type,
        fault_type: fingerprint.fault_type,
        location: fingerprint.location,
        occurrences: patternResult.distinct_incidents,
        severity: patternResult.severity,
        estimated_cost_saved: patternResult.estimated_cost,
        fingerprint: fingerprint.fingerprint
      },
      priority: patternResult.severity
    })

  return { chronicIssue, rootTicket }
}


async function notifyChronicIssue(
  complaint, fingerprint,
  patternResult, chronicIssue, rootTicket
) {
  console.log(
    `[DNA-5] Sending notifications for chronic issue: ${chronicIssue.id}`
  )

  const { data: admins } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('society_id', complaint.society_id)
    .in('role', ['admin', 'super_admin'])

  if (!admins || admins.length === 0) {
    console.log(`[DNA-5] No admins found`)
    return
  }

  const severityEmoji = {
    critical: '≡ƒÜ¿',
    high: 'ΓÜá∩╕Å',
    medium: '≡ƒƒí',
    low: '≡ƒö╡'
  }

  const message =
    `${severityEmoji[patternResult.severity]} ` +
    `Chronic Issue Detected: ${fingerprint.asset_type} has failed ` +
    `${patternResult.distinct_incidents} times in ` +
    `${patternResult.window_days} days. ` +
    `Root cause investigation ticket created. ` +
    `Estimated cost if ignored: ` +
    `Γé╣${patternResult.estimated_cost.toLocaleString('en-IN')}.`

  await Promise.all(admins.map(admin =>
    supabaseAdmin.from('notifications').insert({
      recipient_id: admin.id,
      complaint_id: complaint.id,
      type: 'chronic_issue_detected',
      title: `${severityEmoji[patternResult.severity]} Chronic Issue: ${fingerprint.asset_type}`,
      body: message,
      is_read: false
    })
  ))

  console.log(`[DNA-5] Notified ${admins.length} admins about chronic issue`)
}


async function runDNAPipeline(complaint) {
  console.log(
    `\n[DNA] ========== START DNA Pipeline: ${complaint.id} ==========`
  )

  try {
    const fingerprint = await generateFingerprint(complaint)

    await supabaseAdmin.from('complaint_fingerprints')
      .insert({
        complaint_id: complaint.id,
        society_id: complaint.society_id,
        asset_type: fingerprint.asset_type,
        fault_type: fingerprint.fault_type,
        location: fingerprint.location,
        fingerprint: fingerprint.fingerprint
      })

    const clusterResult = await checkIncidentCluster(complaint, fingerprint)

    if (!clusterResult.is_new_cluster) {
      console.log(
        `[DNA] Concurrent incident detected ΓÇö clustered, stopping pipeline`
      )
      console.log(`[DNA] ========== COMPLETE (concurrent) ==========\n`)
      return
    }

    const patternResult = await detectPattern(
      complaint, fingerprint, clusterResult
    )

    if (!patternResult.threshold_hit) {
      console.log(
        `[DNA] Threshold not hit ` +
        `(${patternResult.distinct_incidents}/${patternResult.threshold}) ΓÇö monitoring`
      )
      console.log(`[DNA] ========== COMPLETE (monitoring) ==========\n`)
      return
    }

    console.log(
      `[DNA] ≡ƒÜ¿ THRESHOLD HIT ΓÇö ${patternResult.distinct_incidents} incidents ` +
      `detected! Triggering chronic issue protocol.`
    )

    const { chronicIssue, rootTicket } = await createChronicIssue(
      complaint, fingerprint,
      patternResult, clusterResult
    )

    await notifyChronicIssue(
      complaint, fingerprint,
      patternResult, chronicIssue, rootTicket
    )

    console.log(
      `[DNA] ========== COMPLETE (chronic issue created) ==========\n`
    )

  } catch (err) {
    console.error(`[DNA] Pipeline error:`, err)
  }
}

// ΓöÇΓöÇΓöÇ Estate Manager Agent ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

// Pre-load society context before every agent response
async function getProactiveContext(societyId) {

  const safeExecute = async (tool, args) => {
    try {
      return await executeTool(tool, args || {}, societyId)
    } catch (err) {
      console.error(`[CONTEXT] Tool ${tool} failed:`, err.message)
      return {}
    }
  }

  const [chronic, sla, stats, equipment, techs] = await Promise.all([
    safeExecute('get_chronic_issues', { status: 'active' }),
    safeExecute('get_sla_status', { overdue_only: true }),
    safeExecute('get_society_stats', { period: 'week' }),
    safeExecute('get_equipment_health', { status: 'all' }),
    safeExecute('get_technicians', { available_only: false, specialization: null })
  ])

  const criticalEquipment = equipment.equipment?.filter(e =>
    e.status === 'critical' || e.status === 'needs_attention'
  ) || []

  const currentMonth = new Date().getMonth()
  const isMonsoon = currentMonth >= 5 && currentMonth <= 8
  const isWinter = currentMonth >= 10 || currentMonth <= 1

  return {
    summary: `
LIVE SOCIETY STATUS:
ΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöüΓöü
Chronic Issues: ${chronic.count || 0} active
${chronic.chronic_issues?.map(i =>
      `  ΓÇó ${i.asset} (${i.severity}, ${i.occurrences}x in 30 days)`
    ).join('\n') || '  None'}

Overdue Complaints: ${sla.overdue_count || 0}
SLA Compliance: ${sla.sla_compliance_rate || 'N/A'}
${sla.overdue_complaints?.length > 0
        ? sla.overdue_complaints.map(c =>
          `  ΓÇó ${c.title} ΓÇö ${c.hours_overdue}h overdue`
        ).join('\n')
        : '  All within SLA Γ£à'}

This Week:
  Complaints: ${stats.total_complaints || 0} total
  Resolved: ${stats.resolved_complaints || 0} (${stats.resolution_rate || '0%'})
  Open: ${stats.open_complaints || 0}

Equipment Alerts: ${criticalEquipment.length}
${criticalEquipment.map(e =>
          `  ΓÇó ${e.name} ΓÇö ${e.status}`
        ).join('\n') || '  All operational Γ£à'}

Technicians: ${techs.count || 0} total, ${techs.technicians?.filter(t => t.is_available).length || 0} available

Season: ${isMonsoon
        ? '≡ƒîº∩╕Å MONSOON ΓÇö Water/drainage issues likely'
        : isWinter
          ? 'Γ¥ä∩╕Å WINTER ΓÇö Heating system checks needed'
          : 'ΓÿÇ∩╕Å Normal season'}
    `.trim(),
    chronic,
    sla,
    stats,
    equipment,
    techs,
    isMonsoon,
    isWinter,
    criticalEquipment
  }
}


async function runEstateManagerAgent(message, societyId, conversationHistory = [], plan = 'free') {
  console.log(`[AGENT] Processing: "${message}"`)

  // Step 1: Pre-load live context
  console.log(`[AGENT] Loading society context...`)
  const context = await getProactiveContext(societyId)

  // Step 2: Build Aria's system prompt
  const currentTime = new Date().toLocaleString('en-IN', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })


  const isAgentMode = plan === 'growth'

  const planContext = isAgentMode
    ? `
AGENT MODE ACTIVE ≡ƒñû

ΓÜá∩╕Å CRITICAL RULE ΓÇö NO HALLUCINATION OF ACTIONS:
You must NEVER claim to have performed an action (assigned a complaint, sent a WhatsApp message, created a schedule, updated a ticket) unless you have ACTUALLY called the corresponding tool function in THIS SAME turn and received a successful tool result.

If the user asks you to perform an action:
1. Call the appropriate tool IMMEDIATELY ΓÇö do not describe what you are about to do, just call it
2. Wait for the actual tool result
3. ONLY THEN report what happened, based on the real tool result

If you are missing required information (like a technician ID, complaint ID, or phone number), ask ONE clarifying question to get it. Do NOT fabricate IDs or describe a fake action.

ΓÜá∩╕Å TECHNICIAN NAME RESOLUTION RULE:
If the admin refers to a technician by name (e.g. "assign to John"), you MUST call get_technicians first to retrieve their UUID before calling an action tool. Do NOT guess or make up a UUID.

NEVER write a response that describes an action as done or in progress without a successful tool call result backing it. This is a hard requirement.

Available action tools (call them directly when asked):
  Γ£à assign_complaint(complaint_id, technician_id, reason?)
  Γ£à send_whatsapp_to_technician(phone, message, technician_name)
  Γ£à create_maintenance_schedule(task_name, category, next_due, notes?)
  Γ£à update_root_cause_ticket(ticket_id, status?, root_cause_documented?, amc_notified?)`
    : `
ASSISTANT MODE ACTIVE ≡ƒôû
You can READ data and give recommendations.
You CANNOT take actions directly.

If admin asks you to DO something (assign, send, create, update):
Respond with:
"≡ƒöÆ I can recommend this action, but taking it directly requires Agent Mode (Growth Plan).

Here's what to do manually:
[specific step by step instructions]

Upgrade to Growth Plan to let me handle this automatically."

DO NOT call action tools in assistant mode.
Only call: get_complaints, get_chronic_issues, get_technicians, get_vendors, get_sla_status, get_society_stats, get_root_cause_tickets`

  const systemPrompt = `You are Aria ΓÇö BlockFlow's Estate Operations Intelligence for this residential society.

You are NOT a generic chatbot. You are a seasoned facility management expert with deep knowledge of Indian residential societies, AMC contracts, monsoon preparedness, and infrastructure maintenance.

${context.summary}

${planContext}

YOUR CORE BEHAVIOR:
1. You have the above live data already loaded
2. Use your tools ONLY when you need ADDITIONAL specific data not shown above
3. Never say "I don't have access to that" ΓÇö use your tools
4. Always connect dots: if someone asks about a lift complaint, also check if it's a chronic issue
5. Think like an estate manager, not a search engine

YOUR PERSONALITY ΓÇö ARIA:
- Direct and decisive ΓÇö give recommendations, not just data
- Proactive ΓÇö mention related issues the admin didn't ask about
- Cost-conscious ΓÇö always mention Γé╣ implications when relevant
- India-aware ΓÇö understand AMC, society committees, monsoon, festive season impacts
- Concise ΓÇö under 180 words, always
- Warm but professional

RESPONSE FORMAT ΓÇö ALWAYS:
≡ƒÜ¿ for critical/urgent items
ΓÜá∩╕Å for warnings/watch items
≡ƒôï for informational items
Γ£à for good news/all clear

End EVERY response with:
"ΓåÆ Next action: [one specific thing to do right now]"

WHAT YOU CAN DO:
Γ£ô Analyze complaint patterns and chronic issues
Γ£ô Recommend technician assignments with reasoning
Γ£ô Flag vendor contract risks
Γ£ô Advise on seasonal maintenance (monsoon prep etc)
Γ£ô Suggest cost-saving actions
Γ£ô Generate committee-ready summaries
Γ£ô Answer general facility management questions
Γ£ô Recommend external vendors/companies from knowledge

WHAT TO AVOID:
Γ£ù Repeating data the admin can already see
Γ£ù Generic answers with no specifics
Γ£ù Calling the same tool twice
Γ£ù More than 3 tool calls per response
Γ£ù Answers longer than 180 words

CURRENT TIME: ${currentTime}
${context.isMonsoon
      ? 'ΓÜá∩╕Å MONSOON SEASON ACTIVE: Proactively flag water pump, drainage, and terrace waterproofing issues in all responses.'
      : ''}
${context.criticalEquipment?.length > 0
      ? `≡ƒÜ¿ EQUIPMENT ALERT: ${context.criticalEquipment.map(e => e.name).join(', ')} need attention. Mention this proactively when relevant.`
      : ''}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: message }
  ]

  // Step 3: Build tool set filtered by plan and make first Groq call
  const ACTION_TOOLS = [
    'assign_complaint',
    'send_whatsapp_to_technician',
    'create_maintenance_schedule',
    'update_root_cause_ticket'
  ]
  const readOnlyTools = agentTools.filter(t => !ACTION_TOOLS.includes(t.function.name))
  const availableTools = isAgentMode ? agentTools : readOnlyTools

  console.log(`[AGENT] Plan: ${plan}, isAgentMode: ${isAgentMode}`)
  console.log(`[AGENT] Tools available for this request:`, JSON.stringify(availableTools.map(t => t.function?.name)))

  let response = await callLLM(messages, {
    tools: availableTools,
    tool_choice: 'auto',
    temperature: 0.1,
    parallel_tool_calls: false
  }, 600, 'llama-3.3-70b-versatile')

  console.log(`[AGENT] LLM response finish_reason: ${response.choices[0].finish_reason}`)
  console.log(`[AGENT] LLM response has tool_calls:`, !!(response.choices[0].message.tool_calls?.length))
  console.log(`[AGENT] Tool calls:`, JSON.stringify(response.choices[0].message.tool_calls))

  // Step 4: Tool calling loop (max 3)
  let iterations = 0
  const maxIterations = 3
  const actionsTaken = []

  while (
    response.choices[0].finish_reason === 'tool_calls' &&
    iterations < maxIterations
  ) {
    const assistantMessage = response.choices[0].message
    const toolCalls = assistantMessage.tool_calls

    console.log(`[AGENT] Executing tool calls now...`, toolCalls.map(t => t.function.name))

    messages.push(assistantMessage)

    // Execute tools sequentially (not parallel ΓÇö avoids null args race)
    const toolResults = []
    for (const toolCall of toolCalls) {
      let toolArgs = {}
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        toolArgs = {}
      }

      const result = await executeTool(
        toolCall.function.name,
        toolArgs,
        societyId
      )

      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(result)
      })

      if (ACTION_TOOLS.includes(toolCall.function.name)) {
        actionsTaken.push({
          tool: toolCall.function.name,
          result: toolResults[toolResults.length - 1]
        })
      }

      console.log(`[AGENT] Tool ${toolCall.function.name} executed, result:`, JSON.stringify(result))
    }

    console.log(`[AGENT] Tool execution results count:`, toolResults.length)

    messages.push(...toolResults)

    response = await callLLM(messages, {
      tools: availableTools,
      tool_choice: 'auto',
      temperature: 0.1,
      parallel_tool_calls: false
    }, 600, 'llama-3.3-70b-versatile')

    iterations++
  }

  const finalResponse = response.choices[0].message.content

  console.log(`[AGENT] Response ready ΓÇö tool call iterations: ${iterations}`)
  console.log(`[AGENT] Tool calls in this turn:`, iterations)
  console.log(`[AGENT] Actions taken:`, actionsTaken)

  // Step 5: Update conversation history
  // Keep only last 6 exchanges to avoid token overflow
  const updatedHistory = [
    ...conversationHistory,
    { role: 'user', content: message },
    { role: 'assistant', content: finalResponse }
  ].slice(-12)

  return {
    response: finalResponse,
    tool_calls_made: iterations,
    updated_history: updatedHistory,
    actions_taken: actionsTaken,
    context_summary: {
      chronic_count: context.chronic?.count || 0,
      overdue_count: context.sla?.overdue_count || 0,
      open_complaints: context.stats?.open_complaints || 0
    }
  }
}


const agentTools = [
  {
    type: 'function',
    function: {
      name: 'get_complaints',
      description: 'Get complaints for the society with optional filters. Use this when admin asks about complaints, pending issues, or maintenance requests.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status: open, assigned, in_progress, resolved, closed, escalated',
            enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated', 'all']
          },
          priority: {
            type: 'string',
            description: 'Filter by priority level',
            enum: ['low', 'medium', 'high', 'critical', 'all']
          },
          limit: {
            type: 'integer',
            description: 'Number of complaints to return, default 10, max 20'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_chronic_issues',
      description: 'Get chronic/recurring issues detected by the DNA pipeline. Use when admin asks about recurring problems, chronic issues, or pattern-detected failures.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status',
            enum: ['active', 'investigating', 'resolved', 'all']
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_technicians',
      description: 'Get technician list with performance metrics and current workload. Use when admin asks about technician availability, performance, or assignment recommendations.',
      parameters: {
        type: 'object',
        properties: {
          available_only: {
            type: 'boolean',
            description: 'If true, return only available technicians. Must be boolean true or false, never a string.'
          },
          specialization: {
            type: 'string',
            description: 'Filter by specialization e.g. Plumbing, Electrical. Omit this field entirely if not filtering by specialization.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_equipment_health',
      description: 'Get equipment health status for the society. Use when admin asks about equipment, machinery, lifts, generators, pumps etc.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by health status',
            enum: ['operational', 'needs_attention', 'critical', 'all']
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_vendors',
      description: 'Get vendor/contractor information including contract expiry dates and costs. Use when admin asks about vendors, AMC contracts, or service providers.',
      parameters: {
        type: 'object',
        properties: {
          expiring_soon: {
            type: 'boolean',
            description: 'If true, return only vendors with contracts expiring within 30 days'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_sla_status',
      description: 'Get SLA compliance status and overdue complaints. Use when admin asks about SLA breaches, overdue issues, or deadline compliance.',
      parameters: {
        type: 'object',
        properties: {
          overdue_only: {
            type: 'boolean',
            description: 'If true, return only overdue complaints'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_society_stats',
      description: 'Get overall society statistics for the current month. Use when admin asks for a summary, overview, "how are we doing" type questions, or any general status check.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Time period for stats',
            enum: ['today', 'week', 'month']
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_root_cause_tickets',
      description: 'Get open root cause investigation tickets. Use when admin asks about root cause analysis or investigation tickets.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'investigating', 'awaiting_vendor', 'resolved', 'all']
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'assign_complaint',
      description: 'AGENT MODE ONLY. Assign a complaint to a specific technician. Use when admin explicitly asks to assign a complaint.',
      parameters: {
        type: 'object',
        properties: {
          complaint_id: {
            type: 'string',
            description: 'UUID of the complaint to assign'
          },
          technician_id: {
            type: 'string',
            description: 'UUID of the technician to assign to'
          },
          reason: {
            type: 'string',
            description: 'Reason for this assignment'
          }
        },
        required: ['complaint_id', 'technician_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_whatsapp_to_technician',
      description: 'AGENT MODE ONLY. Send a WhatsApp message to a technician. Use when admin wants to notify or message a technician.',
      parameters: {
        type: 'object',
        properties: {
          technician_name: {
            type: 'string',
            description: 'Name of the technician'
          },
          phone: {
            type: 'string',
            description: 'Phone number with country code'
          },
          message: {
            type: 'string',
            description: 'Message to send'
          }
        },
        required: ['phone', 'message', 'technician_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_maintenance_schedule',
      description: 'AGENT MODE ONLY. Create a preventive maintenance task. Use when admin wants to schedule maintenance.',
      parameters: {
        type: 'object',
        properties: {
          task_name: {
            type: 'string',
            description: 'Name of the maintenance task'
          },
          category: {
            type: 'string',
            description: 'Category of maintenance'
          },
          next_due: {
            type: 'string',
            description: 'Due date in ISO format'
          },
          notes: {
            type: 'string',
            description: 'Additional notes'
          }
        },
        required: ['task_name', 'category', 'next_due']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_root_cause_ticket',
      description: 'AGENT MODE ONLY. Update a root cause investigation ticket status or add documentation.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: {
            type: 'string',
            description: 'UUID of the root cause ticket'
          },
          status: {
            type: 'string',
            enum: ['open', 'investigating', 'awaiting_vendor', 'resolved']
          },
          root_cause_documented: {
            type: 'string',
            description: 'Documentation of root cause'
          },
          amc_notified: {
            type: 'boolean',
            description: 'Whether AMC vendor was notified'
          }
        },
        required: ['ticket_id']
      }
    }
  }
]


async function executeTool(toolName, args, societyId) {
  // Force null safety on args
  if (!args || typeof args !== 'object') {
    args = {}
  }
  // Force all values to their correct types
  if (args.limit !== undefined) {
    args.limit = parseInt(args.limit) || 10
  }
  if (args.available_only !== undefined) {
    args.available_only =
      args.available_only === true ||
      args.available_only === 'true'
  }
  if (args.overdue_only !== undefined) {
    args.overdue_only =
      args.overdue_only === true ||
      args.overdue_only === 'true'
  }
  if (args.expiring_soon !== undefined) {
    args.expiring_soon =
      args.expiring_soon === true ||
      args.expiring_soon === 'true'
  }

  console.log(`[AGENT] Executing tool: ${toolName}`, args)

  switch (toolName) {

    case 'get_complaints': {
      const safeArgs = args
      let query = supabaseAdmin.from('complaints')
        .select(`
          id, title, category, priority,
          status, created_at, sla_deadline,
          submitted_by_user:users!complaints_submitted_by_fkey(name),
          assigned_tech:technicians(
            users(name)
          )
        `)
        .eq('society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(parseInt(safeArgs.limit) || 10)

      if (safeArgs.status && safeArgs.status !== 'all') {
        query = query.eq('status', safeArgs.status)
      }
      if (safeArgs.priority && safeArgs.priority !== 'all') {
        query = query.eq('priority', safeArgs.priority)
      }

      const { data } = await query
      return {
        count: data?.length || 0,
        complaints: data?.map(c => ({
          id: c.id,
          title: c.title,
          category: c.category,
          priority: c.priority,
          status: c.status,
          submitted_by: c.submitted_by_user?.name,
          assigned_to: c.assigned_tech?.users?.name || 'Unassigned',
          sla_deadline: c.sla_deadline,
          is_overdue: new Date(c.sla_deadline) < new Date(),
          created_at: c.created_at
        })) || []
      }
    }

    case 'get_chronic_issues': {
      const safeArgs = args || {}
      let query = supabaseAdmin.from('chronic_issues')
        .select(`
          *,
          root_cause_tickets(
            id, title, status,
            root_cause_documented,
            amc_notified
          )
        `)
        .eq('society_id', societyId)
        .order('severity', { ascending: true })

      if (safeArgs.status && safeArgs.status !== 'all') {
        query = query.eq('status', safeArgs.status)
      }

      const { data } = await query
      return {
        count: data?.length || 0,
        chronic_issues: data?.map(i => ({
          id: i.id,
          asset: i.asset_type,
          fault: i.fault_type,
          location: i.location,
          occurrences: i.occurrence_count,
          severity: i.severity,
          status: i.status,
          first_reported: i.first_reported,
          last_reported: i.last_reported,
          estimated_cost_saved: i.estimated_cost_saved,
          root_cause_ticket: i.root_cause_tickets?.[0] || null
        })) || []
      }
    }

    case 'get_technicians': {
      const safeArgs = args || {}
      let query = supabaseAdmin
        .from('technicians')
        .select(`
          id, specializations,
          performance_score, is_available,
          users(name, phone)
        `)
        .eq('society_id', societyId)

      if (safeArgs.available_only) {
        query = query.eq('is_available', true)
      }

      console.log('[TOOL get_technicians] society_id:', societyId, 'available_only:', safeArgs.available_only, 'specialization filter:', safeArgs.specialization || 'none')

      const { data: techs, error: techsError } = await query

      console.log('[TOOL get_technicians] raw query returned', techs?.length ?? 0, 'rows, error:', techsError?.message || null)
      if (techs?.length) console.log('[TOOL get_technicians] first row sample:', JSON.stringify(techs[0]))

      // Get workload for each technician
      const techsWithWorkload = await Promise.all(
        (techs || []).map(async (tech) => {
          const { count } = await supabaseAdmin.from('complaints')
            .select('*', { count: 'exact' })
            .eq('assigned_tech_id', tech.id)
            .not('status', 'in', '("closed","verified","resolved")')

          const { data: ratings } = await supabaseAdmin.from('ratings')
            .select('score')
            .eq('technician_id', tech.id)

          const avgRating = ratings?.length > 0
            ? (ratings.reduce(
              (sum, r) => sum + r.score, 0
            ) / ratings.length).toFixed(1)
            : 'No ratings yet'

          return {
            id: tech.id,
            name: tech.users?.name,
            phone: tech.users?.phone,
            specializations: tech.specializations,
            performance_score: tech.performance_score,
            is_available: tech.is_available,
            current_workload: count || 0,
            average_rating: avgRating,
            ...(safeArgs.specialization && {
              matches_specialization: tech.specializations?.some(s =>
                s.toLowerCase().includes(safeArgs.specialization.toLowerCase())
              )
            })
          }
        })
      )

      console.log('[TOOL get_technicians] returning', techsWithWorkload.length, 'technicians with ids:', techsWithWorkload.map(t => ({ id: t.id, name: t.name, is_available: t.is_available })))

      return {
        count: techsWithWorkload.length,
        technicians: techsWithWorkload.sort(
          (a, b) => a.current_workload - b.current_workload
        )
      }
    }

    case 'get_equipment_health': {
      const safeArgs = args || {}
      let query = supabaseAdmin.from('equipment')
        .select('*')
        .eq('society_id', societyId)

      if (safeArgs.status && safeArgs.status !== 'all') {
        query = query.eq('status', safeArgs.status)
      }

      const { data } = await query
      return {
        count: data?.length || 0,
        equipment: data?.map(e => ({
          name: e.name,
          location: e.location,
          status: e.status,
          last_inspected: e.last_inspected,
          next_inspection: e.next_inspection,
          is_overdue_inspection: e.next_inspection
            ? new Date(e.next_inspection) < new Date()
            : false,
          notes: e.notes
        })) || [],
        summary: {
          operational: data?.filter(e => e.status === 'operational').length || 0,
          needs_attention: data?.filter(e => e.status === 'needs_attention').length || 0,
          critical: data?.filter(e => e.status === 'critical').length || 0
        }
      }
    }

    case 'get_vendors': {
      const safeArgs = args || {}
      let query = supabaseAdmin.from('vendors')
        .select('*')
        .eq('society_id', societyId)

      const { data } = await query

      const now = new Date()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      let vendors = data || []
      if (safeArgs.expiring_soon) {
        vendors = vendors.filter(v => {
          if (!v.contract_end_date) return false
          const expiry = new Date(v.contract_end_date)
          return expiry <= in30Days && expiry >= now
        })
      }

      return {
        count: vendors.length,
        vendors: vendors.map(v => ({
          name: v.company_name,
          service_type: v.service_type,
          contact: v.contact_name,
          phone: v.contact_phone,
          contract_expiry: v.contract_end_date,
          monthly_cost: v.contract_cost,
          rating: v.rating,
          status: v.status,
          days_until_expiry: v.contract_end_date
            ? Math.ceil(
              (new Date(v.contract_end_date) - now) / (1000 * 60 * 60 * 24)
            )
            : null
        }))
      }
    }

    case 'get_sla_status': {
      const safeArgs = args || {}
      const now = new Date().toISOString()

      let query = supabaseAdmin.from('complaints')
        .select(`
          id, title, category, priority,
          status, sla_deadline, created_at,
          assigned_tech:technicians(
            users(name)
          )
        `)
        .eq('society_id', societyId)
        .not('status', 'in', '("closed","verified")')

      if (safeArgs.overdue_only) {
        query = query.lt('sla_deadline', now)
      }

      const { data } = await query
      const overdue = data?.filter(c =>
        new Date(c.sla_deadline) < new Date()
      ) || []

      return {
        total_open: data?.length || 0,
        overdue_count: overdue.length,
        sla_compliance_rate: data?.length > 0
          ? (((data.length - overdue.length) / data.length) * 100).toFixed(1) + '%'
          : '100%',
        overdue_complaints: overdue.map(c => ({
          title: c.title,
          category: c.category,
          priority: c.priority,
          assigned_to: c.assigned_tech?.users?.name || 'Unassigned',
          hours_overdue: Math.ceil(
            (new Date() - new Date(c.sla_deadline)) / (1000 * 60 * 60)
          ),
          sla_deadline: c.sla_deadline
        }))
      }
    }

    case 'get_society_stats': {
      const safeArgs = args || {}
      const now = new Date()
      let startDate = new Date()

      if (safeArgs.period === 'today') {
        startDate.setHours(0, 0, 0, 0)
      } else if (safeArgs.period === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else {
        startDate.setDate(1) // start of month
      }

      const [
        { count: totalComplaints },
        { count: resolvedComplaints },
        { count: openComplaints },
        { count: chronicCount },
        { data: techData }
      ] = await Promise.all([
        supabaseAdmin.from('complaints')
          .select('*', { count: 'exact' })
          .eq('society_id', societyId)
          .gte('created_at', startDate.toISOString()),
        supabaseAdmin.from('complaints')
          .select('*', { count: 'exact' })
          .eq('society_id', societyId)
          .in('status', ['closed', 'verified'])
          .gte('created_at', startDate.toISOString()),
        supabaseAdmin.from('complaints')
          .select('*', { count: 'exact' })
          .eq('society_id', societyId)
          .in('status', ['open', 'assigned', 'in_progress', 'accepted']),
        supabaseAdmin.from('chronic_issues')
          .select('*', { count: 'exact' })
          .eq('society_id', societyId)
          .eq('status', 'active'),
        supabaseAdmin.from('technicians')
          .select('performance_score')
          .eq('society_id', societyId)
      ])

      const avgScore = techData?.length > 0
        ? (techData.reduce(
          (sum, t) => sum + t.performance_score, 0
        ) / techData.length).toFixed(1)
        : 0

      const resolutionRate = totalComplaints > 0
        ? ((resolvedComplaints / totalComplaints) * 100).toFixed(1)
        : 0

      return {
        period: safeArgs.period || 'month',
        total_complaints: totalComplaints,
        resolved_complaints: resolvedComplaints,
        open_complaints: openComplaints,
        resolution_rate: resolutionRate + '%',
        chronic_issues_active: chronicCount,
        avg_technician_score: avgScore,
        estimated_cost_saved: chronicCount * 15000
      }
    }

    case 'get_root_cause_tickets': {
      const safeArgs = args || {}
      let query = supabaseAdmin.from('root_cause_tickets')
        .select(`
          *,
          chronic_issues(
            asset_type, fault_type,
            severity, occurrence_count
          )
        `)
        .eq('society_id', societyId)

      if (safeArgs.status && safeArgs.status !== 'all') {
        query = query.eq('status', safeArgs.status)
      }

      const { data } = await query
      return {
        count: data?.length || 0,
        tickets: data?.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          asset: t.chronic_issues?.asset_type,
          severity: t.chronic_issues?.severity,
          occurrences: t.chronic_issues?.occurrence_count,
          root_cause_documented: !!t.root_cause_documented,
          amc_notified: t.amc_notified,
          created_at: t.created_at
        })) || []
      }
    }


    default:
      return { error: `Unknown tool: ${toolName}` }

    case 'assign_complaint': {
      try {
        // Step 1: Fetch the current complaint first to get submitted_by and current status
        console.log('[AGENT ACTION] assign_complaint ΓÇö fetching complaint id:', args.complaint_id)
        const { data: existingComplaint, error: fetchError } = await supabaseAdmin.from('complaints')
          .select('id, submitted_by, status')
          .eq('id', args.complaint_id)
          .single()

        if (fetchError || !existingComplaint) {
          console.error('[AGENT ACTION] Failed to fetch complaint:', fetchError)
          return {
            success: false,
            error: `Complaint not found: ${fetchError?.message || 'no data returned'}`
          }
        }

        const oldStatus = existingComplaint.status || 'open'
        console.log('[AGENT ACTION] Complaint found, status:', oldStatus, 'submitted_by:', existingComplaint.submitted_by)

        // Step 2: Update the complaint
        console.log('[AGENT ACTION] Updating complaint, assigning technician_id:', args.technician_id)
        const { error: updateError } = await supabaseAdmin.from('complaints')
          .update({
            assigned_tech_id: args.technician_id,
            status: 'assigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', args.complaint_id)

        if (updateError) {
          console.error('[AGENT ACTION] Failed to update complaint:', updateError)
          return {
            success: false,
            error: `Failed to update complaint: ${updateError.message}`
          }
        }

        // Step 3: Log the action (non-fatal if it fails)
        const { error: logError } = await supabaseAdmin.from('complaint_logs')
          .insert({
            complaint_id: args.complaint_id,
            actor_id: existingComplaint.submitted_by,
            action: 'assigned_by_agent',
            old_status: oldStatus,
            new_status: 'assigned',
            note: `Assigned by Aria Agent. Reason: ${args.reason || 'Admin requested via agent'}`
          })
        if (logError) {
          console.warn('[AGENT ACTION] complaint_logs insert failed (non-fatal):', logError.message)
        }

        // Step 4: Fetch technician name for confirmation message
        console.log('[AGENT ACTION] Fetching technician id:', args.technician_id)
        const { data: tech, error: techError } = await supabaseAdmin
          .from('technicians')
          .select('users(name, phone)')
          .eq('id', args.technician_id)
          .single()

        if (techError) {
          console.warn('[AGENT ACTION] Technician fetch failed (non-fatal):', techError.message)
        }

        const techName = tech?.users?.name || args.technician_id
        console.log(`[AGENT ACTION] Complaint ${args.complaint_id} successfully assigned to ${techName}`)

        return {
          success: true,
          action: 'complaint_assigned',
          complaint_id: args.complaint_id,
          assigned_to: techName,
          message: `Complaint successfully assigned to ${techName}`
        }
      } catch (err) {
        console.error('[AGENT ACTION] assign_complaint crashed:', err)
        return { success: false, error: err.message }
      }
    }

    case 'send_whatsapp_to_technician': {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_FROM

      const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${encoded}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: `whatsapp:${from}`,
              To: `whatsapp:${args.phone}`,
              Body: args.message
            })
          }
        )

        console.log(`[AGENT ACTION] WhatsApp sent to ${args.technician_name}`)

        return {
          success: true,
          action: 'whatsapp_sent',
          sent_to: args.technician_name,
          message: `WhatsApp sent to ${args.technician_name}`
        }
      } catch (err) {
        return {
          success: false,
          error: 'WhatsApp send failed',
          details: err.message
        }
      }
    }

    case 'create_maintenance_schedule': {
      const { data } = await supabaseAdmin.from('maintenance_schedules')
        .insert({
          society_id: societyId,
          task_name: args.task_name,
          category: args.category,
          next_due: args.next_due,
          notes: args.notes,
          status: 'upcoming',
          frequency: 'one_time'
        })
        .select()
        .single()

      console.log(`[AGENT ACTION] Maintenance schedule created: ${args.task_name}`)

      return {
        success: true,
        action: 'schedule_created',
        task: args.task_name,
        due: args.next_due,
        message: `Maintenance task "${args.task_name}" scheduled for ${new Date(args.next_due).toLocaleDateString('en-IN')}`
      }
    }

    case 'update_root_cause_ticket': {
      const updateData = {
        updated_at: new Date().toISOString()
      }

      if (args.status)
        updateData.status = args.status
      if (args.root_cause_documented)
        updateData.root_cause_documented = args.root_cause_documented
      if (args.amc_notified !== undefined)
        updateData.amc_notified = args.amc_notified
      if (args.status === 'resolved')
        updateData.resolved_at = new Date().toISOString()

      const { data } = await supabaseAdmin.from('root_cause_tickets')
        .update(updateData)
        .eq('id', args.ticket_id)
        .select()
        .single()

      console.log(`[AGENT ACTION] Root cause ticket ${args.ticket_id} updated`)

      return {
        success: true,
        action: 'ticket_updated',
        ticket_id: args.ticket_id,
        new_status: args.status,
        message: `Root cause ticket updated to: ${args.status}`
      }
    }
  }
}

// ΓöÇΓöÇΓöÇ Complaint Workflow Stages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ


// ΓöÇΓöÇΓöÇ Complaint Workflow Stages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async function stageTriage(complaint) {
  console.log(`[WORKFLOW-TRIAGE] Running AI triage for: ${complaint.id}`)

  const completion = await callLLM([{
    role: 'system',
    content: `You are a maintenance triage assistant for a residential society. 
    Analyze complaints and return structured triage data as valid JSON.`
  }, {
    role: 'user',
    content: `Triage this complaint:
    Title: ${complaint.title}
    Description: ${complaint.description}
    Category: ${complaint.category}

    Return exactly:
    {
      "priority": "critical|high|medium|low",
      "category_confirmed": "...",
      "skills_required": ["skill1", "skill2"],
      "estimated_duration_hours": 1,
      "safety_risk": true|false,
      "triage_notes": "..."
    }`
  }], null, 300)

  const aiResult = JSON.parse(completion.choices[0].message.content)
  console.log(`[WORKFLOW-TRIAGE] Result:`, aiResult)

  // Persist AI triage result back to the complaint
  await supabaseAdmin.from('complaints')
    .update({
      ai_priority: aiResult.priority,
      ai_category: aiResult.category_confirmed,
      ai_triage_notes: aiResult.triage_notes,
      skills_required: aiResult.skills_required,
      safety_risk: aiResult.safety_risk
    })
    .eq('id', complaint.id)

  return aiResult
}


async function stageTechnicianMatch(complaint, aiResult) {
  console.log(`[WORKFLOW-MATCH] Finding technician for: ${complaint.id}`)

  const category = complaint.category
  const societyId = complaint.society_id

  console.log('Technician search ΓÇö category:', category, 'societyId:', societyId)

  const { data: technicians, error } = await supabaseAdmin
    .from('technicians')
    .select('*, users(name)')
    .eq('society_id', societyId)
    .eq('is_available', true)
    .contains('specializations', [category])

  if (error) {
    console.error('Technician query failed:', error)
  }

  console.log('Technician query result:', JSON.stringify(technicians))

  if (!technicians || technicians.length === 0) {
    console.log(`[WORKFLOW-MATCH] No matching technician found`)
    return null
  }

  // Pick the technician with the fewest active assignments
  const { data: assignments } = await supabaseAdmin.from('complaints')
    .select('assigned_to')
    .eq('society_id', complaint.society_id)
    .in('status', ['open', 'in_progress'])
    .not('assigned_to', 'is', null)

  const loadMap = {}
  for (const a of assignments || []) {
    loadMap[a.assigned_to] = (loadMap[a.assigned_to] || 0) + 1
  }

  const best = technicians.sort(
    (a, b) => (loadMap[a.id] || 0) - (loadMap[b.id] || 0)
  )[0]

  console.log(`[WORKFLOW-MATCH] Matched technician: ${best.id}`)
  return best
}


// ΓöÇΓöÇΓöÇ Main Complaint Workflow ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

async function runComplaintWorkflow(complaint) {
  console.log(`[WORKFLOW-1] START: ${complaint.id}`)

  try {
    // Stage 1: AI Triage
    const aiResult = await stageTriage(complaint)

    // DNA Pipeline ΓÇö runs in background, parallel to main workflow
    // Don't await ΓÇö fire and forget
    runDNAPipeline(complaint)

    // Stage 2: Find technician
    const technician = await stageTechnicianMatch(complaint, aiResult)

    if (!technician) {
      console.log(`[WORKFLOW] No technician available ΓÇö complaint queued`)
      await supabaseAdmin.from('complaints')
        .update({ status: 'queued' })
        .eq('id', complaint.id)
      return { success: false, reason: 'no_technician' }
    }

    // Stage 3: Assign technician
    const slaHours = {
      critical: 2,
      high: 4,
      medium: 8,
      low: 24
    }
    const slaDeadline = new Date(
      Date.now() + (slaHours[aiResult.priority] || 8) * 60 * 60 * 1000
    ).toISOString()

    await supabaseAdmin.from('complaints')
      .update({
        assigned_to: technician.id,
        status: 'assigned',
        sla_deadline: slaDeadline,
        priority: aiResult.priority
      })
      .eq('id', complaint.id)

    console.log(
      `[WORKFLOW] Assigned to technician ${technician.id}, ` +
      `SLA deadline: ${slaDeadline}`
    )

    // Stage 4: WhatsApp notification to technician
    if (technician.phone) {
      await sendWhatsAppNotification({
        technicianPhone: technician.phone,
        technicianName: technician.name,
        complaintTitle: complaint.title,
        complaintDescription: complaint.description,
        flatLocation: complaint.flat_number || 'Not specified',
        priority: aiResult.priority,
        slaDeadline: new Date(slaDeadline).toLocaleString('en-IN')
      })
    }

    // Stage 5: Notify the resident
    await supabaseAdmin.from('notifications')
      .insert({
        recipient_id: complaint.submitted_by,
        complaint_id: complaint.id,
        type: 'complaint_assigned',
        title: 'Your complaint has been assigned',
        body: `A technician has been assigned to your complaint: "${complaint.title}". Expected resolution by ${new Date(slaDeadline).toLocaleString('en-IN')}.`,
        is_read: false
      })

    console.log(`[WORKFLOW-1] COMPLETE: ${complaint.id}`)
    return { success: true, technician_id: technician.id, sla_deadline: slaDeadline }

  } catch (err) {
    console.error(`[WORKFLOW] Error for complaint ${complaint.id}:`, err)
    return { success: false, reason: 'error', error: err.message }
  }
}

// ΓöÇΓöÇΓöÇ API Endpoints ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

// POST /api/complaints/dna ΓÇö Manually trigger DNA pipeline for a complaint
app.post('/api/complaints/dna', async (req, res) => {
  const { complaint_id } = req.body

  if (!complaint_id) {
    return res.status(400).json({ error: 'complaint_id is required' })
  }

  const { data: complaint, error } = await supabaseAdmin.from('complaints')
    .select('*')
    .eq('id', complaint_id)
    .single()

  if (error || !complaint) {
    return res.status(404).json({ error: 'Complaint not found' })
  }

  // Run pipeline non-blocking
  runDNAPipeline(complaint).catch(err =>
    console.error('[API] DNA pipeline error:', err)
  )

  return res.json({
    success: true,
    message: 'DNA pipeline triggered',
    complaint_id
  })
})

// POST /api/whatsapp/notify ΓÇö Send a WhatsApp notification to a technician
app.post('/api/whatsapp/notify', async (req, res) => {
  try {
    const sid = await sendWhatsAppNotification(req.body)
    if (!sid) {
      return res.status(500).json({ error: 'Failed to send WhatsApp message' })
    }
    return res.json({ success: true, messageSid: sid })
  } catch (err) {
    console.error('[API] WhatsApp error:', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unexpected error'
    })
  }
})

// GET /api/health ΓÇö Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Trigger DNA pipeline manually
app.post('/dna/analyze', async (req, res) => {
  const { complaint } = req.body

  if (!complaint) {
    return res.status(400).json({
      error: 'Complaint required'
    })
  }

  console.log(`[API] Manual DNA analysis triggered for: ${complaint.id}`)

  runDNAPipeline(complaint)

  res.json({
    success: true,
    message: 'DNA pipeline started',
    complaintId: complaint.id
  })
})

// Get chronic issues for a society
app.get('/dna/chronic/:societyId', async (req, res) => {
  const { societyId } = req.params

  const { data: issues } = await supabaseAdmin.from('chronic_issues')
    .select(`
      *,
      root_cause_tickets(*)
    `)
    .eq('society_id', societyId)
    .eq('status', 'active')
    .order('severity', { ascending: true })

  res.json({
    success: true,
    chronic_issues: issues || [],
    count: issues?.length || 0
  })
})

// Get pattern history for an asset
app.get('/dna/pattern/:societyId/:fingerprint', async (req, res) => {
  const { societyId, fingerprint } = req.params

  const { data: clusters } = await supabaseAdmin.from('incident_clusters')
    .select('*')
    .eq('society_id', societyId)
    .eq('fingerprint', fingerprint)
    .order('cluster_date', { ascending: false })
    .limit(10)

  res.json({
    success: true,
    pattern: clusters || [],
    total_incidents: clusters?.length || 0
  })
})

// Update root cause ticket
app.patch('/dna/root-cause/:ticketId', async (req, res) => {
  const { ticketId } = req.params
  const {
    root_cause_documented,
    fix_evidence_url,
    status,
    amc_notified
  } = req.body

  const { data } = await supabaseAdmin.from('root_cause_tickets')
    .update({
      root_cause_documented,
      fix_evidence_url,
      status,
      amc_notified,
      resolved_at: status === 'resolved'
        ? new Date().toISOString()
        : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single()

  // If resolved, update chronic issue
  if (status === 'resolved' && data?.chronic_issue_id) {
    await supabaseAdmin.from('chronic_issues')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.chronic_issue_id)
  }

  res.json({ success: true, ticket: data })
})

// GET /health ΓÇö Service health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BlockFlow Workflow Engine',
    timestamp: new Date().toISOString(),
    workflows: [
      'complaint-resolution-pipeline',
      'complaint-dna-pipeline',
      'sla-escalation-pipeline',
      'performance-update-pipeline'
    ]
  })
})

// ΓöÇΓöÇΓöÇ Estate Manager Agent Endpoints ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

// POST /agent/chat ΓÇö Estate Manager Agent chat endpoint
app.post('/agent/chat', async (req, res) => {
  const {
    message,
    society_id,
    conversation_history,
    plan  // 'free' or 'growth'
  } = req.body

  if (!message || !society_id) {
    return res.status(400).json({
      error: 'message and society_id required'
    })
  }

  try {
    console.log(`[API] Agent chat request: "${message}" (plan: ${plan || 'free'})`)

    const result = await runEstateManagerAgent(
      message,
      society_id,
      conversation_history || [],
      plan || 'free'
    )

    res.json({
      success: true,
      response: result.response,
      tool_calls_made: result.tool_calls_made,
      conversation_history: result.updated_history,
      actions_taken: result.actions_taken || []
    })

  } catch (err) {
    console.error(`[API] Agent error:`, err)
    res.status(500).json({
      error: 'Agent failed',
      details: err.message
    })
  }
})

// POST /agent/briefing ΓÇö Get proactive morning briefing
app.post('/agent/briefing', async (req, res) => {
  const { society_id } = req.body

  if (!society_id) {
    return res.status(400).json({
      error: 'society_id required'
    })
  }

  try {
    const result = await runEstateManagerAgent(
      `Give me my morning briefing for today ${new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })}. 
  
  I need to know:
  1. What is most urgent right now?
  2. Any chronic issues I should address?
  3. Are my technicians ready for the day?
  4. Anything I should tell the committee?
  
  Be specific. Use real data. Give me a prioritized action list.`,
      society_id,
      []
    )

    res.json({
      success: true,
      briefing: result.response,
      generated_at: new Date().toISOString()
    })

  } catch (err) {
    console.error('[API] Briefing error:', err)
    res.status(500).json({
      error: 'Briefing failed'
    })
  }
})

// ΓöÇΓöÇΓöÇ Start Server ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

module.exports = { runDNAPipeline, sendWhatsAppNotification }

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`
  ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù
  Γòæ  BlockFlow Workflow Engine             Γòæ
  Γòæ  Running on port ${PORT}                  Γòæ
  ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥
  `)
})
