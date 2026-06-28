import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, ArrowLeft, Check } from 'iconoir-react';

// Fallback inline SVG for EyeOff
const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18M10.5 10.677a2 2 0 002.823 2.823M7.362 7.561C5.68 8.74 4.279 10.42 3 12c1.889 2.991 5.282 6 9 6 1.508 0 2.9-.323 4.134-.89m2.26-2.26C20.12 13.882 21.055 12.96 21 12c-1.889-2.991-5.282-6-9-6-1.274 0-2.47.224-3.562.631" />
  </svg>
);

const Spinner = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}>
    <style>{'@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'}</style>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [societyName, setSocietyName] = useState('');
  const [city, setCity] = useState('');
  const [towers, setTowers] = useState('');
  const [flats, setFlats] = useState('');
  const [address, setAddress] = useState('');

  // Step 3
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Step A: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: { full_name: name.trim() }
        }
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Failed to create account.');

      // Step B: Insert society
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: society, error: socError } = await supabase
        .from('societies')
        .insert({
          name: societyName.trim(),
          city: city.trim(),
          address: address.trim() || null,
          total_towers: Number(towers),
          total_flats: Number(flats),
          plan: 'free',
          invite_code: inviteCode
        })
        .select()
        .single();
      
      if (socError) throw new Error(socError.message);

      // Step C: Insert admin user
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          name: name.trim(),
          email: email.trim(),
          role: 'admin',
          status: 'active',
          society_id: society.id,
        });
      if (userError) throw new Error(userError.message);

      // Step D: Insert towers
      const numTowers = Number(towers);
      const towersData = Array.from({ length: numTowers }, (_, i) => ({
        society_id: society.id,
        name: numTowers === 1 ? 'Main Block' : 'Tower ' + String.fromCharCode(65 + i),
      }));
      
      const { data: insertedTowers, error: towersError } = await supabase
        .from('towers')
        .insert(towersData)
        .select();
        
      if (towersError) throw new Error(towersError.message);

      // Step D2: Auto-seed flats
      if (insertedTowers) {
        const numFlats = Number(flats);
        const flatsPerTower = Math.ceil(numFlats / numTowers);
        const flatsPerFloor = 4;
        const floorCount = Math.ceil(flatsPerTower / flatsPerFloor);
  
        const flatsToInsert: any[] = [];
        
        for (const tower of insertedTowers) {
          const towerPrefix = numTowers === 1 ? '' : (tower.name.split(' ')[1] + '-');
          let flatsCreated = 0;
          for (let floor = 1; floor <= floorCount; floor++) {
            for (let flatNum = 1; flatNum <= flatsPerFloor; flatNum++) {
              if (flatsCreated >= flatsPerTower) break;
              const flatNumberStr = `${towerPrefix}${floor}${String(flatNum).padStart(2, '0')}`;
              flatsToInsert.push({
                society_id: society.id,
                tower_id: tower.id,
                flat_number: flatNumberStr,
                is_claimed: false
              });
              flatsCreated++;
            }
          }
        }
  
        if (flatsToInsert.length > 0) {
          const { error: flatsError } = await supabase.from('flats').insert(flatsToInsert);
          if (flatsError) console.error('Failed to seed flats:', flatsError);
        }
      }

      // Step E: Navigate to success
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid #E0DDD9',
    fontSize: 15,
    fontFamily: 'Inter',
    color: '#1C1917',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  };
  
  const labelStyle = {
    display: 'block',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 500,
    color: '#1C1917',
    fontFamily: 'Inter',
  };
  
  const buttonStyle = {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#1C1917',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'Inter',
    cursor: 'pointer',
    marginTop: 24,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  };
  
  const buttonDisabledStyle = {
    ...buttonStyle,
    backgroundColor: '#E0DDD9',
    color: '#9C9894',
    cursor: 'not-allowed',
  };

  const step1Valid = societyName.trim() && city.trim() && towers && Number(towers) >= 1 && flats && Number(flats) >= 1;
  const step3Valid = name.trim() && email.trim() && password.length >= 8 && confirmPassword === password && terms;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#EDEBE6',
      fontFamily: 'Inter',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 560,
        boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
        boxSizing: 'border-box'
      }}>
        
        {/* HEADER */}
        {step < 4 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 24, color: '#1C1917', margin: 0 }}>BlockFlow</h1>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                  <ArrowLeft width={20} height={20} color="#9C9894" />
                </button>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#9C9894', margin: '0 0 8px 0' }}>
                  Step {step} of 4
                </p>
                <div style={{ height: 4, backgroundColor: '#E0DDD9', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(step / 4) * 100}%`, height: '100%', backgroundColor: '#D97706', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#1C1917' }}>Set up your community</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: '0 0 24px 0' }}>Tell us about your housing society</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Society Name</label>
                <input style={inputStyle} value={societyName} onChange={(e) => setSocietyName(e.target.value)} placeholder="e.g. Prestige Lakeside Habitat" />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru" />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Number of Towers/Blocks</label>
                  <input type="number" min="1" max="50" style={inputStyle} value={towers} onChange={(e) => setTowers(e.target.value)} placeholder="e.g. 4" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Total Flats</label>
                  <input type="number" min="1" style={inputStyle} value={flats} onChange={(e) => setFlats(e.target.value)} placeholder="e.g. 200" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Address <span style={{ color: '#9C9894', fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...inputStyle, resize: 'none', height: 80 }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Society address (optional)" />
              </div>
            </div>

            <button 
              style={!step1Valid ? buttonDisabledStyle : buttonStyle}
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Continue &rarr;
            </button>
            <p style={{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: '#9C9894',
              textAlign: 'center',
              marginTop: '16px'
            }}>
              Already a resident? Ask your estate 
              manager for an invite link to join.
            </p>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#1C1917' }}>Choose your plan</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: '0 0 24px 0' }}>Start free, upgrade anytime</p>

            <div style={{ display: 'flex', gap: 16, flexDirection: window.innerWidth < 500 ? 'column' : 'row' }}>
              {/* Free Plan */}
              <div style={{ flex: 1, border: '2px solid #D97706', borderRadius: 16, padding: 20, position: 'relative', background: '#FFFFFF' }}>
                <div style={{ position: 'absolute', top: -10, left: 20, background: '#D97706', color: '#FFFFFF', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, fontFamily: 'Inter' }}>Current Plan</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, margin: '16px 0 4px', color: '#1C1917' }}>Free</h3>
                <p style={{ fontFamily: 'Inter', fontSize: 24, fontWeight: 700, margin: '0 0 16px', color: '#1C1917' }}>₹0 <span style={{ fontSize: 14, fontWeight: 400, color: '#6B6560' }}>/ month</span></p>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Up to 100 flats', 'Complaint management', 'Staff management', 'Basic analytics', 'WhatsApp notifications'].map((feat, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: 'Inter', color: '#1C1917' }}>
                      <Check width={16} height={16} color="#D97706" /> {feat}
                    </li>
                  ))}
                </ul>

                <button style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontWeight: 600, fontSize: 14, fontFamily: 'Inter', cursor: 'default' }}>
                  Get Started Free
                </button>
              </div>

              {/* Growth Plan */}
              <div style={{ flex: 1, border: '1px solid #E0DDD9', borderRadius: 16, padding: 20, position: 'relative', background: '#FAFAF9', opacity: 0.7 }}>
                <div style={{ position: 'absolute', top: -10, left: 20, background: '#9C9894', color: '#FFFFFF', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, fontFamily: 'Inter' }}>Coming Soon</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, margin: '16px 0 4px', color: '#6B6560' }}>Growth</h3>
                <p style={{ fontFamily: 'Inter', fontSize: 24, fontWeight: 700, margin: '0 0 16px', color: '#6B6560' }}>₹99 <span style={{ fontSize: 14, fontWeight: 400 }}>per flat / month</span></p>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Unlimited flats', 'Everything in Free', 'AI-powered insights', 'Priority support', 'Custom branding'].map((feat, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: 'Inter', color: '#6B6560' }}>
                      <Check width={16} height={16} color="#9C9894" /> {feat}
                    </li>
                  ))}
                </ul>

                <button style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#E0DDD9', color: '#6B6560', border: 'none', fontWeight: 600, fontSize: 14, fontFamily: 'Inter', cursor: 'not-allowed' }} disabled>
                  Coming Soon
                </button>
              </div>
            </div>

            <button style={buttonStyle} onClick={() => setStep(3)}>Continue &rarr;</button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#1C1917' }}>Create your admin account</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: '0 0 24px 0' }}>You will manage the community as the estate manager</p>

            {error && (
              <div style={{ background: '#FFF1F2', color: '#BE123C', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontFamily: 'Inter' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yoursociety.com" />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9C9894' }}>
                    {showPassword ? <EyeOffIcon /> : <Eye width={20} height={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input type="password" style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== password ? '#BE123C' : '#E0DDD9' }} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
                {confirmPassword && confirmPassword !== password && (
                  <p style={{ color: '#BE123C', fontSize: 12, margin: '4px 0 0', fontFamily: 'Inter' }}>Passwords do not match</p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
                <input type="checkbox" id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: '#D97706' }} />
                <label htmlFor="terms" style={{ fontSize: 13, color: '#6B6560', fontFamily: 'Inter', lineHeight: 1.5, cursor: 'pointer' }}>
                  I agree to the <a href="#" style={{ color: '#D97706', textDecoration: 'none' }}>Terms of Service</a> and <a href="#" style={{ color: '#D97706', textDecoration: 'none' }}>Privacy Policy</a>
                </label>
              </div>
            </div>

            <button 
              style={loading || !step3Valid ? buttonDisabledStyle : buttonStyle}
              disabled={loading || !step3Valid}
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <Spinner />
                  Setting up your community...
                </>
              ) : (
                'Create Community'
              )}
            </button>
          </div>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Check width={32} height={32} strokeWidth={2} />
            </div>
            
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, margin: '0 0 24px 0', color: '#1C1917' }}>
              🎉 Your community is live!
            </h2>

            <div style={{ background: '#FAFAF9', border: '1px solid #E0DDD9', borderRadius: 16, padding: 24, textAlign: 'left', marginBottom: 24 }}>
              <p style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 600, color: '#1C1917', margin: '0 0 4px' }}>{societyName}</p>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#6B6560', margin: '0 0 16px' }}>{city}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: 8, border: '1px solid #E0DDD9' }}>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Towers</p>
                  <p style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, color: '#1C1917', margin: 0 }}>{towers}</p>
                </div>
                <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: 8, border: '1px solid #E0DDD9' }}>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#9C9894', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Flats</p>
                  <p style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, color: '#1C1917', margin: 0 }}>{flats}</p>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#6B6560' }}>Plan:</span>
                <span style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'Inter' }}>Free</span>
              </div>
            </div>

            <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#6B6560', margin: '0 0 32px 0', lineHeight: 1.5 }}>
              Your admin account has been created.<br/>You can now manage your community from the dashboard.
            </p>

            <button style={buttonStyle} onClick={() => navigate('/admin')}>
              Go to Dashboard &rarr;
            </button>
          </div>
        )}

        {/* FOOTER LOGIN LINK */}
        {step < 4 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <a onClick={() => navigate('/login')} style={{ fontFamily: 'Inter', fontSize: 14, color: '#D97706', cursor: 'pointer', textDecoration: 'none' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
              Already a member? Login
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
