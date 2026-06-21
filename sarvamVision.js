const fs = require('fs')
const path = require('path')
const os = require('os')
const AdmZip = require('adm-zip')

async function getSarvamClient() {
  // sarvamai may be ESM-only — use dynamic import
  const { SarvamAIClient } = await import('sarvamai')
  return new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY
  })
}

async function digitizeDocument(
  filePath, languageCode = 'en-IN') {

  console.log(`[VISION] ===== START: ${filePath} =====`)

  const client = await getSarvamClient()

  console.log('[VISION] Creating job...')
  const job = await client.documentIntelligence
    .createJob({
      language: languageCode,
      outputFormat: 'md'
    })
  console.log('[VISION] Job object:', JSON.stringify(job, null, 2))

  console.log('[VISION] Uploading file:', filePath)
  await job.uploadFile(filePath)

  console.log('[VISION] Starting job...')
  await job.start()

  console.log('[VISION] Waiting for completion (this polls internally)...')
  const status = await job.waitUntilComplete()
  console.log('[VISION] Final status:', JSON.stringify(status, null, 2))

  const outputZipPath = path.join(
    os.tmpdir(),
    `sarvam_output_${Date.now()}.zip`
  )

  console.log('[VISION] Downloading output to:', outputZipPath)
  await job.downloadOutput(outputZipPath)

  // Unzip and extract markdown + json content
  const zip = new AdmZip(outputZipPath)
  const entries = zip.getEntries()
  console.log('[VISION] Zip contents:', entries.map(e => e.entryName))

  let extractedText = ''
  let jsonData = null

  for (const entry of entries) {
    if (entry.entryName.endsWith('.md')) {
      extractedText += entry.getData().toString('utf8') + '\n'
    }
    if (entry.entryName.endsWith('.json')) {
      try {
        jsonData = JSON.parse(entry.getData().toString('utf8'))
      } catch (e) {
        console.warn('[VISION] Could not parse json entry:', e.message)
      }
    }
  }

  // Cleanup temp files (don't crash if missing)
  fs.unlink(outputZipPath, () => {})
  fs.unlink(filePath, () => {})

  console.log(`[VISION] ===== COMPLETE: extracted ${extractedText.length} chars =====`)

  return { extractedText, jsonData }
}

module.exports = { digitizeDocument }
