require('dotenv').config({ path: '.env.local' })

const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const Groq = require('groq-sdk')

const app = express()
app.use(cors())
app.use(express.json())

// ─── Supabase & Groq Clients ──────────────────────────────────────────────────

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
)

// Service-role client — bypasses RLS for privileged server-side queries
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
})

// ─── WhatsApp Helper Function ─────────────────────────────────────────────────

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
    critical: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  }

  const emoji = priorityEmoji[priority?.toLowerCase()] ?? '⚪'

  const messageBody = [
    `🔧 *New Task Assigned — BlockFlow*`,
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

// ─── Complaint DNA Pipeline ───────────────────────────────────────────────────

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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
      max_tokens: 200,
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

  const { data: todayCluster } = await supabase
    .from('incident_clusters')
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

    await supabase
      .from('incident_clusters')
      .update({
        complaint_ids: updatedIds,
        complaint_count: updatedIds.length
      })
      .eq('id', todayCluster.id)

    await supabase
      .from('complaints')
      .update({
        incident_cluster_id: todayCluster.id,
        fingerprint: fingerprint.fingerprint
      })
      .eq('id', complaint.id)

    console.log(
      `[DNA-2] Concurrent incident — added to cluster ${todayCluster.id}. ` +
      `Total today: ${updatedIds.length}`
    )

    return {
      is_new_cluster: false,
      cluster_id: todayCluster.id,
      is_concurrent: true
    }
  }

  const { data: newCluster } = await supabase
    .from('incident_clusters')
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

  await supabase
    .from('complaints')
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

  const { data: clusters } = await supabase
    .from('incident_clusters')
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

  const { data: existing } = await supabase
    .from('chronic_issues')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('fingerprint', fingerprint.fingerprint)
    .eq('status', 'active')
    .single()

  let chronicIssue

  if (existing) {
    const { data: updated } = await supabase
      .from('chronic_issues')
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

    const { data: created } = await supabase
      .from('chronic_issues')
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

  await supabase
    .from('complaints')
    .update({
      is_chronic: true,
      chronic_issue_id: chronicIssue.id
    })
    .eq('id', complaint.id)

  const { data: rootTicket } = await supabase
    .from('root_cause_tickets')
    .insert({
      chronic_issue_id: chronicIssue.id,
      society_id: complaint.society_id,
      title: `ROOT CAUSE: ${fingerprint.asset_type.toUpperCase()} — ${fingerprint.fault_type.toUpperCase()}`,
      description:
        `This asset has failed ${patternResult.distinct_incidents} times ` +
        `in ${patternResult.window_days} days. ` +
        `Estimated cost saved by addressing root cause: ` +
        `₹${patternResult.estimated_cost.toLocaleString('en-IN')}.\n\n` +
        `Recent complaints fingerprinted as: ${fingerprint.fingerprint}\n\n` +
        `Action required: Document root cause and implement permanent fix.`,
      status: 'open',
      amc_notified: false
    })
    .select()
    .single()

  console.log(`[DNA-4] Root cause ticket created: ${rootTicket.id}`)

  await supabase
    .from('agent_context')
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
    critical: '🚨',
    high: '⚠️',
    medium: '🟡',
    low: '🔵'
  }

  const message =
    `${severityEmoji[patternResult.severity]} ` +
    `Chronic Issue Detected: ${fingerprint.asset_type} has failed ` +
    `${patternResult.distinct_incidents} times in ` +
    `${patternResult.window_days} days. ` +
    `Root cause investigation ticket created. ` +
    `Estimated cost if ignored: ` +
    `₹${patternResult.estimated_cost.toLocaleString('en-IN')}.`

  await Promise.all(admins.map(admin =>
    supabase.from('notifications').insert({
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

    await supabase
      .from('complaint_fingerprints')
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
        `[DNA] Concurrent incident detected — clustered, stopping pipeline`
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
        `(${patternResult.distinct_incidents}/${patternResult.threshold}) — monitoring`
      )
      console.log(`[DNA] ========== COMPLETE (monitoring) ==========\n`)
      return
    }

    console.log(
      `[DNA] 🚨 THRESHOLD HIT — ${patternResult.distinct_incidents} incidents ` +
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

// ─── Complaint Workflow Stages ────────────────────────────────────────────────

async function stageTriage(complaint) {
  console.log(`[WORKFLOW-TRIAGE] Running AI triage for: ${complaint.id}`)

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
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
    }],
    temperature: 0.1,
    max_tokens: 300,
    response_format: { type: 'json_object' }
  })

  const aiResult = JSON.parse(completion.choices[0].message.content)
  console.log(`[WORKFLOW-TRIAGE] Result:`, aiResult)

  // Persist AI triage result back to the complaint
  await supabase
    .from('complaints')
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

  const { data: technicians } = await supabase
    .from('technicians')
    .select('*')
    .eq('society_id', complaint.society_id)
    .eq('is_available', true)
    .containedBy('skills', aiResult.skills_required || [])

  if (!technicians || technicians.length === 0) {
    console.log(`[WORKFLOW-MATCH] No matching technician found`)
    return null
  }

  // Pick the technician with the fewest active assignments
  const { data: assignments } = await supabase
    .from('complaints')
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


// ─── Main Complaint Workflow ──────────────────────────────────────────────────

async function runComplaintWorkflow(complaint) {
  console.log(`[WORKFLOW-1] START: ${complaint.id}`)

  try {
    // Stage 1: AI Triage
    const aiResult = await stageTriage(complaint)

    // DNA Pipeline — runs in background, parallel to main workflow
    // Don't await — fire and forget
    runDNAPipeline(complaint)

    // Stage 2: Find technician
    const technician = await stageTechnicianMatch(complaint, aiResult)

    if (!technician) {
      console.log(`[WORKFLOW] No technician available — complaint queued`)
      await supabase
        .from('complaints')
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

    await supabase
      .from('complaints')
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
    await supabase
      .from('notifications')
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

// ─── API Endpoints ────────────────────────────────────────────────────────────

// POST /api/complaints/dna — Manually trigger DNA pipeline for a complaint
app.post('/api/complaints/dna', async (req, res) => {
  const { complaint_id } = req.body

  if (!complaint_id) {
    return res.status(400).json({ error: 'complaint_id is required' })
  }

  const { data: complaint, error } = await supabase
    .from('complaints')
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

// POST /api/whatsapp/notify — Send a WhatsApp notification to a technician
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

// GET /api/health — Health check
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

  const { data: issues } = await supabase
    .from('chronic_issues')
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

  const { data: clusters } = await supabase
    .from('incident_clusters')
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

  const { data } = await supabase
    .from('root_cause_tickets')
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
  if (status === 'resolved') {
    await supabase
      .from('chronic_issues')
      .update({
        status: 'resolved',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.chronic_issue_id)
  }

  res.json({ success: true, ticket: data })
})

// GET /health — Service health check
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

// ─── Start Server ─────────────────────────────────────────────────────────────

module.exports = { runDNAPipeline, sendWhatsAppNotification }

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║  BlockFlow Workflow Engine             ║
  ║  Running on port ${PORT}                  ║
  ╚════════════════════════════════════════╝
  `)
})
