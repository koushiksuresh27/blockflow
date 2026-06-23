import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import type { ChangeEvent } from 'react';

// Inline SVG Spinner
const Spinner = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    <style>
      {`
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}
    </style>
  </svg>
);

export default function ResidentSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [searchTerm, setSearchTerm] = useState('');
  const [societies, setSocieties] = useState<any[]>([]);
  const [selectedSociety, setSelectedSociety] = useState<any>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Step 2 state
  const [fullName, setFullName] = useState('');
  const [tower, setTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length > 0) {
        searchSocieties();
      } else {
        setSocieties([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  async function searchSocieties() {
    setLoadingSearch(true);
    const { data } = await supabase
      .from('societies')
      .select('id, name, city, total_flats, total_towers')
      .ilike('name', `%${searchTerm}%`)
      .limit(10);
    
    setSocieties(data || []);
    setLoadingSearch(false);
  }

  const handleContinueGoogle = async () => {
    if (!selectedSociety || !fullName) return;

    localStorage.setItem('pendingSocietyId', selectedSociety.id);
    localStorage.setItem('pendingResidentName', fullName);
    localStorage.setItem('pendingResidentTower', tower);
    localStorage.setItem('pendingResidentFlat', flatNumber);

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback'
      }
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#EDEBE6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '480px',
        padding: '32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)'
      }}>
        {/* Progress Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#1C1917'
          }}></div>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            border: step === 2 ? 'none' : '1px solid #E0DDD9',
            backgroundColor: step === 2 ? '#1C1917' : 'transparent'
          }}></div>
        </div>

        {step === 1 && (
          <div>
            <h1 style={{
              fontFamily: 'Recoleta, serif',
              fontSize: '28px',
              color: '#1C1917',
              margin: '0 0 8px 0',
              textAlign: 'center'
            }}>Join Your Society</h1>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              color: '#6B6560',
              margin: '0 0 24px 0',
              textAlign: 'center'
            }}>Search for your housing society to get started</p>

            <input
              type="text"
              placeholder="Search society name or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #E0DDD9',
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                marginBottom: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ minHeight: '200px', maxHeight: '300px', overflowY: 'auto' }}>
              {loadingSearch && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                  <Spinner />
                </div>
              )}
              
              {!loadingSearch && searchTerm && societies.length === 0 && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#6B6560', textAlign: 'center', padding: '24px' }}>
                  No society found. Ask your estate manager to register on BlockFlow.
                </p>
              )}

              {!loadingSearch && societies.map(society => (
                <div
                  key={society.id}
                  onClick={() => setSelectedSociety(society)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: selectedSociety?.id === society.id ? '2px solid #D97706' : '1px solid #E0DDD9',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    backgroundColor: selectedSociety?.id === society.id ? 'rgba(217,119,6,0.05)' : '#FFFFFF',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#1C1917', marginBottom: '4px' }}>
                    {society.name}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B6560' }}>
                    {society.city} &middot; {society.total_towers} towers &middot; {society.total_flats} flats
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={!selectedSociety}
              onClick={() => setStep(2)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: selectedSociety ? '#1C1917' : '#E0DDD9',
                color: selectedSociety ? '#FFFFFF' : '#A8A29D',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                fontSize: '15px',
                cursor: selectedSociety ? 'pointer' : 'not-allowed',
                marginTop: '24px',
                transition: 'all 0.2s ease'
              }}
            >
              Continue &rarr;
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <button
              onClick={() => setStep(1)}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: '#6B6560',
                cursor: 'pointer',
                padding: '0',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              &larr; Back
            </button>

            <h1 style={{
              fontFamily: 'Recoleta, serif',
              fontSize: '28px',
              color: '#1C1917',
              margin: '0 0 24px 0'
            }}>Your details</h1>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: '#1C1917', marginBottom: '6px' }}>
                Full name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E0DDD9',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: '#1C1917', marginBottom: '6px' }}>
                Tower/Block <span style={{ color: '#A8A29D' }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tower A, Wing B"
                value={tower}
                onChange={(e) => setTower(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E0DDD9',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, color: '#1C1917', marginBottom: '6px' }}>
                Flat number <span style={{ color: '#A8A29D' }}>(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 304, B-12"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E0DDD9',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              disabled={!fullName.trim()}
              onClick={handleContinueGoogle}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: fullName.trim() ? '#1C1917' : '#E0DDD9',
                color: fullName.trim() ? '#FFFFFF' : '#A8A29D',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 600,
                fontSize: '15px',
                cursor: fullName.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
