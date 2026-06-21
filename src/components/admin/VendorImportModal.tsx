import { useState } from 'react'
import { CloudUpload, Page, Trash, Xmark, Check } from 'iconoir-react'

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001'

interface VendorRecord {
  company_name: string
  service_type: string
  contact_name: string | null
  contact_phone: string | null
  contract_cost: number | null
  contract_end_date: string | null
  notes: string | null
}

interface Props {
  societyId: string
  onClose: () => void
  onImportComplete: () => void
}

type Step = 'upload' | 'processing' | 'review' | 'importing'

const SERVICE_TYPES = [
  'Plumbing', 'Electrical', 'Lift', 'Security', 'Housekeeping', 
  'Pest Control', 'Generator', 'Landscaping', 'Other'
]

export default function VendorImportModal({ societyId, onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vendors, setVendors] = useState<VendorRecord[]>([])
  const [error, setError] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return
    
    setStep('processing')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`${WORKFLOW_URL}/import/vendors/analyze`, { 
        method: 'POST', 
        body: formData 
      })

      const data = await res.json()

      if (!data.success || !data.vendors) {
        throw new Error(data.error || 'Analysis failed')
      }

      if (data.vendors.length === 0) {
        setError('No vendor data found in this document. Try a clearer image or a document with a vendor list/table.')
        setStep('upload')
        return
      }

      setVendors(data.vendors)
      setStep('review')

    } catch (err: any) {
      setError(err.message || 'Failed to analyze document')
      setStep('upload')
    }
  }

  const updateVendor = (index: number, field: string, value: any) => {
    setVendors(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
  }

  const removeVendor = (index: number) => {
    setVendors(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirmImport = async () => {
    setStep('importing')

    try {
      const res = await fetch(`${WORKFLOW_URL}/import/vendors/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendors, society_id: societyId })
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error('Import failed')
      }

      onImportComplete()
      onClose()

    } catch (err: any) {
      setError(err.message || 'Failed to import vendors')
      setStep('review')
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(28,25,23,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: step === 'review' ? '640px' : '440px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E0DDD9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <p style={{
              fontFamily: 'Space Grotesk',
              fontWeight: '700',
              fontSize: '18px',
              color: '#1C1917',
              margin: 0
            }}>
              {step === 'review' ? `Found ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}` : 'Import Vendors from Document'}
            </p>
            <p style={{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: '#9C9894',
              margin: '2px 0 0'
            }}>
              {step === 'review' ? 'Review and edit before importing' : 'Upload a vendor list, AMC contract, or invoice'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'processing' || step === 'importing'}
            style={{
              background: '#F5F3F0',
              border: 'none',
              borderRadius: '8px',
              width: '32px', height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6B6560'
            }}
          >
            <Xmark width={16} height={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1
        }}>

          {/* STEP: UPLOAD */}
          {step === 'upload' && (
            <div>
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                border: '2px dashed #E0DDD9',
                borderRadius: '16px',
                padding: '40px 20px',
                cursor: 'pointer',
                background: selectedFile ? '#F5F3F0' : 'transparent',
                transition: 'all 0.15s'
              }}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {selectedFile ? (
                  <>
                    <Page width={32} height={32} strokeWidth={1.5} color="#1C1917" />
                    <p style={{
                      fontFamily: 'Space Grotesk',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#1C1917',
                      margin: 0,
                      textAlign: 'center'
                    }}>
                      {selectedFile.name}
                    </p>
                    <p style={{
                      fontFamily: 'Inter',
                      fontSize: '12px',
                      color: '#9C9894',
                      margin: 0
                    }}>
                      Tap to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <CloudUpload width={32} height={32} strokeWidth={1.5} color="#9C9894" />
                    <p style={{
                      fontFamily: 'Space Grotesk',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#1C1917',
                      margin: 0
                    }}>
                      Tap to upload
                    </p>
                    <p style={{
                      fontFamily: 'Inter',
                      fontSize: '12px',
                      color: '#9C9894',
                      margin: 0,
                      textAlign: 'center'
                    }}>
                      PDF, PNG or JPG — vendor list, contract, or invoice
                    </p>
                  </>
                )}
              </label>

              {error && (
                <p style={{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: '#DC2626',
                  marginTop: '12px',
                  lineHeight: '1.5'
                }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '12px',
                  background: selectedFile ? '#1C1917' : '#E0DDD9',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: selectedFile ? 'pointer' : 'not-allowed'
                }}
              >
                Analyze Document
              </button>
            </div>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: '16px'
            }}>
              <div style={{
                width: '40px', height: '40px',
                border: '3px solid #E0DDD9',
                borderTopColor: '#D97706',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                color: '#1C1917',
                margin: 0
              }}>
                Analyzing your document...
              </p>
              <p style={{
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#9C9894',
                margin: 0
              }}>
                This usually takes 10-30 seconds
              </p>
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === 'review' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {vendors.map((vendor, i) => (
                <div key={i} style={{
                  background: '#F5F3F0',
                  border: '1px solid #E0DDD9',
                  borderRadius: '14px',
                  padding: '16px',
                  position: 'relative'
                }}>
                  <button
                    onClick={() => removeVendor(i)}
                    style={{
                      position: 'absolute',
                      top: '12px', right: '12px',
                      background: 'none',
                      border: 'none',
                      color: '#9C9894',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash width={15} height={15} strokeWidth={1.5} />
                  </button>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px'
                  }}>
                    <div>
                      <label style={{
                        fontSize: '11px',
                        fontFamily: 'Space Grotesk',
                        fontWeight: '500',
                        color: '#6B6560',
                        display: 'block',
                        marginBottom: '4px'
                      }}>
                        Company Name
                      </label>
                      <input
                        value={vendor.company_name || ''}
                        onChange={(e) => updateVendor(i, 'company_name', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Service Type
                      </label>
                      <select
                        value={vendor.service_type || 'Other'}
                        onChange={(e) => updateVendor(i, 'service_type', e.target.value)}
                        style={inputStyle}
                      >
                        {SERVICE_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contact Name
                      </label>
                      <input
                        value={vendor.contact_name || ''}
                        onChange={(e) => updateVendor(i, 'contact_name', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contact Phone
                      </label>
                      <input
                        value={vendor.contact_phone || ''}
                        onChange={(e) => updateVendor(i, 'contact_phone', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contract Cost (₹)
                      </label>
                      <input
                        type="number"
                        value={vendor.contract_cost || ''}
                        onChange={(e) => updateVendor(i, 'contract_cost', parseFloat(e.target.value) || null)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Contract End Date
                      </label>
                      <input
                        type="date"
                        value={vendor.contract_end_date || ''}
                        onChange={(e) => updateVendor(i, 'contract_end_date', e.target.value || null)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>
                        Notes
                      </label>
                      <input
                        value={vendor.notes || ''}
                        onChange={(e) => updateVendor(i, 'notes', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {vendors.length === 0 && (
                <p style={{
                  textAlign: 'center',
                  color: '#9C9894',
                  fontFamily: 'Inter',
                  fontSize: '13px',
                  padding: '20px'
                }}>
                  All vendors removed. Cancel and try again.
                </p>
              )}

              {error && (
                <p style={{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: '#DC2626'
                }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* STEP: IMPORTING */}
          {step === 'importing' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: '16px'
            }}>
              <div style={{
                width: '40px', height: '40px',
                border: '3px solid #E0DDD9',
                borderTopColor: '#D97706',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <p style={{
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                color: '#1C1917'
              }}>
                Importing vendors...
              </p>
            </div>
          )}
        </div>

        {/* Footer — only on review step */}
        {step === 'review' && vendors.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E0DDD9',
            display: 'flex',
            gap: '10px'
          }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                border: '1px solid #E0DDD9',
                borderRadius: '10px',
                color: '#6B6560',
                fontFamily: 'Space Grotesk',
                fontWeight: '500',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              style={{
                flex: 2,
                padding: '12px',
                background: '#D97706',
                border: 'none',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontFamily: 'Space Grotesk',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Check width={16} height={16} strokeWidth={2} />
              Import {vendors.length} Vendor{vendors.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
      `}</style>
    </div>
  )
}

const labelStyle = {
  fontSize: '11px',
  fontFamily: 'Space Grotesk',
  fontWeight: '500',
  color: '#6B6560',
  display: 'block',
  marginBottom: '4px'
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #E0DDD9',
  borderRadius: '8px',
  fontFamily: 'Inter',
  fontSize: '13px',
  color: '#1C1917',
  background: '#FFFFFF',
  boxSizing: 'border-box' as const
}
