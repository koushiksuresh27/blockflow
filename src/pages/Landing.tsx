import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

// SVG Components
const ComplaintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="3" width="14" height="18" rx="2" />
    <line x1="7" y1="8" x2="15" y2="8" />
    <line x1="7" y1="12" x2="15" y2="12" />
    <line x1="7" y1="16" x2="11" y2="16" />
    <circle cx="18" cy="5" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const AutoAssignIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
    <path d="M13 12 L17 12 L15 10 M17 12 L15 14" strokeLinejoin="round" />
  </svg>
);

const SLAIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <polygon points="12 2 22 7.5 22 16.5 12 22 2 16.5 2 7.5 12 2" />
    <path d="M13 7 L9 13 L11 13 L11 17 L15 11 L13 11 Z" fill="currentColor" stroke="none" />
  </svg>
);

const PhotoProofIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M3 16 L8 11 L13 16" />
    <path d="M11 14 L15 10 L21 16" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <path d="M16 16 L19 19 L23 14" strokeWidth="2" stroke="currentColor" />
  </svg>
);

const GatePassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="9" x2="16" y2="9" />
    <line x1="8" y1="12" x2="13" y2="12" />
    <rect x="8" y="15" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="13" y="15" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="8" y="18" width="3" height="3" fill="currentColor" stroke="none" />
    <rect x="13" y="18" width="3" height="3" fill="currentColor" stroke="none" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="14" width="4" height="6" rx="1" />
    <rect x="10" y="9" width="4" height="11" rx="1" />
    <rect x="16" y="4" width="4" height="16" rx="1" />
    <path d="M2 12 Q6 8 10 10 T20 2" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M12 2L2 20h20L12 2z" />
    <line x1="12" y1="8" x2="12" y2="14" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const BrokenChainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M8 12a4 4 0 01-4-4 4 4 0 014-4h2" />
    <path d="M16 12a4 4 0 014 4 4 4 0 01-4 4h-2" />
    <line x1="8" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="16" y2="12" />
  </svg>
);

const EyeXIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M2 12c0 0 4-8 10-8s10 8 10 8-4 8-10 8-10-8-10-8z" />
    <circle cx="12" cy="12" r="3" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

const CheckIcon = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Landing() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "Is BlockFlow really free?",
      a: "Yes. Our free plan is completely free forever with no hidden charges. We're introducing our Growth plan in about a month with advanced features — but core maintenance workflows will always have a free tier."
    },
    {
      q: "Do technicians need to download an app?",
      a: "Technicians receive task notifications via WhatsApp — no app download needed to get notified. They can download BlockFlow for the full dashboard with photo uploads and performance tracking."
    },
    {
      q: "How does auto-assignment work?",
      a: "When a resident submits a complaint, BlockFlow automatically finds the best available technician based on their specialization, current workload, and performance score — no manual work from the admin."
    },
    {
      q: "Is my data private?",
      a: "BlockFlow is zero-ads and never sells your data. We charge a subscription — not your privacy. Your society's data is never shared with third parties."
    },
    {
      q: "How long does setup take?",
      a: "Most societies are fully set up in under 30 minutes. Admin creates the structure, invites residents, adds technicians — and BlockFlow is live."
    },
    {
      q: "What if a technician rejects a task?",
      a: "BlockFlow automatically reassigns to the next available technician. The rejection reason is logged and visible to the admin."
    }
  ];

  return (
    <div className="landing-container">
      {/* SECTION 1 — NAVBAR */}
      <nav className={`landing-nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          <img src="/logo.png" alt="BlockFlow Logo" height="36" />
          BlockFlow
        </div>
        <div className="nav-links">
          <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('#how-it-works'); }}>How it Works</a>
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('#features'); }}>Features</a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('#pricing'); }}>Pricing</a>
          <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('#faq'); }}>FAQ</a>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/login')}>Login</button>
          <button className="btn btn-primary" onClick={() => navigate('/onboarding')}>Get Started</button>
          <button className="mobile-menu-btn">☰</button>
        </div>
      </nav>

      {/* SECTION 2 — HERO */}
      <section className="hero-section">
        <div className="hero-bg-circle hero-bg-circle-1"></div>
        <div className="hero-bg-circle hero-bg-circle-2"></div>

        <div className="hero-content">
          <h1 className="hero-title">
            Apartment Maintenance.
            <span>Finally Managed.</span>
          </h1>
          <p className="hero-subtitle">
            BlockFlow automates maintenance workflows, holds technicians accountable, and gives residents real-time visibility — all in one beautifully designed platform.
          </p>
          <div className="hero-cta-group">
            <button className="btn btn-primary" style={{ background: '#1C1917', color: '#FFFFFF', border: 'none' }} onClick={() => navigate('/onboarding')}>Get Started Free</button>
            <button className="btn btn-ghost" style={{ background: 'transparent', border: '1px solid #1C1917', color: '#1C1917' }} onClick={() => navigate('/login')}>Already a member?</button>
          </div>
          <div className="trust-line">
            No credit card &nbsp;·&nbsp; Free forever &nbsp;·&nbsp; Setup in 5 minutes
          </div>
          <div className="dashboard-mockup animate-on-scroll">
            Dashboard Preview
          </div>
        </div>
      </section>

      {/* SECTION 3 — PROBLEM & SOLUTION */}
      <section className="problem-solution-section">
        <div className="problem-solution-container">
          <div className="section-label" style={{ color: 'var(--martinique)', opacity: 0.5 }}>THE PROBLEM</div>
          <h2 className="section-title">Maintenance is broken.</h2>

          <div className="cards-row animate-on-scroll">
            <div className="card problem-card">
              <div className="card-icon"><WarningIcon /></div>
              <h3 className="card-title">Complaints Get Lost</h3>
              <p className="card-body">Issues submitted through WhatsApp and phone calls get forgotten with zero follow-up or tracking.</p>
            </div>
            <div className="card problem-card">
              <div className="card-icon"><BrokenChainIcon /></div>
              <h3 className="card-title">No Accountability</h3>
              <p className="card-body">Technicians work without formal assignments, proof of work, or any performance measurement.</p>
            </div>
            <div className="card problem-card">
              <div className="card-icon"><EyeXIcon /></div>
              <h3 className="card-title">Zero Visibility</h3>
              <p className="card-body">Admins have no data on resolution times, SLA compliance, or recurring infrastructure problems.</p>
            </div>
          </div>

          <div className="section-divider animate-on-scroll"></div>

          <div className="section-label" style={{ color: 'var(--martinique)' }}>THE SOLUTION</div>

          <div className="cards-row animate-on-scroll" style={{ marginTop: '32px' }}>
            <div className="card solution-card">
              <div className="card-icon"><ComplaintIcon /></div>
              <h3 className="card-title">Every Complaint Tracked</h3>
              <p className="card-body">Submit, assign, track and close every issue with a full audit trail and real-time status updates.</p>
            </div>
            <div className="card solution-card">
              <div className="card-icon"><PhotoProofIcon /></div>
              <h3 className="card-title">Full Accountability</h3>
              <p className="card-body">Digital task assignments, before/after photo proof, resident ratings and performance analytics.</p>
            </div>
            <div className="card solution-card">
              <div className="card-icon"><AnalyticsIcon /></div>
              <h3 className="card-title">Live Operations Dashboard</h3>
              <p className="card-body">SLA compliance, resolution times, technician leaderboards — all updating in real time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="how-it-works-container">
          <div className="section-label" style={{ color: 'var(--martinique)', opacity: 0.5 }}>HOW IT WORKS</div>
          <h2 className="section-title">Three roles. One platform.</h2>

          <div className="cards-row animate-on-scroll">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-badge">RESIDENT</div>
              <div className="card-icon"><ComplaintIcon /></div>
              <h3 className="step-title">Submit a Complaint</h3>
              <ul className="step-features">
                <li><div className="step-check"><CheckIcon /></div> Photo attachments</li>
                <li><div className="step-check"><CheckIcon /></div> Priority selection</li>
                <li><div className="step-check"><CheckIcon /></div> Real-time tracking</li>
                <li><div className="step-check"><CheckIcon /></div> Rate completed work</li>
              </ul>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-badge">AUTO-ASSIGN</div>
              <div className="card-icon"><AutoAssignIcon /></div>
              <h3 className="step-title">Smart Assignment</h3>
              <ul className="step-features">
                <li><div className="step-check"><CheckIcon /></div> Specialization matching</li>
                <li><div className="step-check"><CheckIcon /></div> SLA deadlines set</li>
                <li><div className="step-check"><CheckIcon /></div> WhatsApp notification sent</li>
                <li><div className="step-check"><CheckIcon /></div> Admin oversight</li>
              </ul>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-badge">TECHNICIAN</div>
              <div className="card-icon"><PhotoProofIcon /></div>
              <h3 className="step-title">Fix & Prove It</h3>
              <ul className="step-features">
                <li><div className="step-check"><CheckIcon /></div> WhatsApp task alert</li>
                <li><div className="step-check"><CheckIcon /></div> Before/after photos</li>
                <li><div className="step-check"><CheckIcon /></div> Resident verification</li>
                <li><div className="step-check"><CheckIcon /></div> Performance scored</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — FEATURES */}
      <section id="features" className="features-section">
        <div className="features-container">
          <div className="section-label" style={{ color: 'var(--martinique)', opacity: 0.5 }}>FEATURES</div>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Everything your society needs.</h2>
          <p className="features-subtitle">
            Built specifically for apartment maintenance — not a generic society app with a complaint form bolted on.
          </p>

          <div className="features-grid animate-on-scroll">
            <div className="feature-card">
              <div className="card-icon"><ComplaintIcon /></div>
              <h3 className="card-title">Smart Auto-Assignment</h3>
              <p className="card-body">Complaints automatically routed to the right technician based on specialization and live workload.</p>
            </div>
            <div className="feature-card">
              <div className="card-icon"><AutoAssignIcon /></div>
              <h3 className="card-title">WhatsApp Alerts</h3>
              <p className="card-body">Technicians get instant WhatsApp notifications for every new task — no separate app needed.</p>
            </div>
            <div className="feature-card">
              <div className="card-icon"><SLAIcon /></div>
              <h3 className="card-title">SLA Enforcement</h3>
              <p className="card-body">Set resolution deadlines per complaint type. Auto-escalation when SLAs are at risk.</p>
            </div>
            <div className="feature-card">
              <div className="card-icon"><PhotoProofIcon /></div>
              <h3 className="card-title">Photo Proof of Work</h3>
              <p className="card-body">Before and after photos mandatory for every job. Full accountability, zero disputes.</p>
            </div>
            <div className="feature-card">
              <div className="card-icon"><GatePassIcon /></div>
              <h3 className="card-title">Gate Pass System</h3>
              <p className="card-body">Residents generate OTP passes for visitors. Security verifies in seconds.</p>
            </div>
            <div className="feature-card">
              <div className="card-icon"><AnalyticsIcon /></div>
              <h3 className="card-title">Live Analytics</h3>
              <p className="card-body">Complaint heatmaps, technician leaderboards, and facility health scores updating in real time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — PRICING */}
      <section id="pricing" className="pricing-section">
        <div className="pricing-container">
          <div className="section-label" style={{ color: 'rgba(215,218,220,0.5)' }}>PRICING</div>
          <h2 className="pricing-title">Simple, honest pricing.</h2>
          <p className="pricing-subtitle">
            Start free. No credit card. Upgrade when you're ready.
          </p>

          <div className="pricing-grid animate-on-scroll">
            <div className="pricing-card pricing-card-free">
              <div className="pricing-badge badge-free">AVAILABLE NOW</div>
              <div className="plan-name plan-name-free">Free</div>
              <div className="plan-price plan-price-free">₹0</div>
              <div className="plan-period plan-period-free">forever</div>

              <div className="plan-divider divider-free"></div>

              <ul className="plan-features features-free">
                <li><div className="plan-check check-free"><CheckIcon /></div> Up to 50 residents</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Full complaint workflow</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Technician management</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Admin dashboard</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Gate pass system</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> WhatsApp notifications</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Community board</li>
                <li><div className="plan-check check-free"><CheckIcon /></div> Basic analytics</li>
              </ul>

              <button className="btn plan-btn btn-free" onClick={() => navigate('/onboarding')}>Get Started Free</button>
              <div className="plan-note note-free">No credit card required</div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <a onClick={() => navigate('/login')} style={{ fontSize: 13, color: '#D97706', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Already a member? Login &rarr;</a>
              </div>
            </div>

            <div className="pricing-card pricing-card-growth">
              <div className="pricing-badge badge-growth">LAUNCHING IN 1 MONTH</div>
              <div className="plan-name plan-name-growth">Growth</div>
              <div className="plan-price plan-price-growth">₹12</div>
              <div className="plan-period plan-period-growth">per flat / month</div>

              <div className="plan-divider divider-growth"></div>

              <ul className="plan-features features-growth">
                <li><div className="plan-check check-growth"><CheckIcon /></div> Everything in Free</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Unlimited residents</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Advanced analytics</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> AI priority suggestions</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Preventive maintenance</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Equipment monitoring</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> SLA auto-escalation</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> NRO dashboard</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Priority support</li>
                <li><div className="plan-check check-growth"><CheckIcon /></div> Custom SLA rules</li>
              </ul>

              <button className="btn plan-btn btn-growth">Join Waitlist</button>
              <div className="plan-note note-growth">Free trial · No bank details needed</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — FAQ */}
      <section id="faq" className="faq-section">
        <div className="faq-container">
          <div className="section-label" style={{ color: 'var(--martinique)', opacity: 0.5, textAlign: 'center' }}>FAQ</div>
          <h2 className="faq-title">Questions, answered.</h2>

          <div className="animate-on-scroll">
            {faqs.map((faq, index) => (
              <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={index}>
                <button className="faq-question" onClick={() => toggleFaq(index)}>
                  {faq.q}
                  <div className="faq-toggle">{openFaq === index ? '−' : '+'}</div>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner">{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — FINAL CTA */}
      <section className="cta-section">
        <div className="cta-bg-circle cta-bg-circle-1"></div>
        <div className="cta-bg-circle cta-bg-circle-2"></div>

        <div className="cta-content">
          <div className="hero-badge">GET STARTED TODAY</div>
          <h2 className="cta-title">Your society deserves better.</h2>
          <p className="cta-subtitle">
            Join housing societies already using BlockFlow to manage maintenance — faster, smarter, with full accountability.
          </p>
          <div className="hero-cta-group" style={{ marginBottom: 0, flexDirection: 'column', gap: 16 }}>
            <button className="btn btn-primary" style={{ background: 'var(--iron)', color: 'var(--martinique)' }} onClick={() => navigate('/onboarding')}>
              Get Started Free
            </button>
            <a onClick={() => navigate('/login')} style={{ fontSize: 14, color: '#D97706', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Already a member? Login &rarr;</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-logo">
                <img src="/logo.png" alt="BlockFlow" />
                BlockFlow
              </div>
              <p className="footer-desc">
                The apartment operations platform built for modern Indian societies.
              </p>
            </div>

            <div className="footer-col">
              <div className="footer-col-label">PRODUCT</div>
              <ul className="footer-links">
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('#features'); }}>Features</a></li>
                <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('#how-it-works'); }}>How it Works</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); scrollTo('#pricing'); }}>Pricing</a></li>
                <li><a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('#faq'); }}>FAQ</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-label">COMPANY</div>
              <ul className="footer-links">
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <div className="footer-col-label">LEGAL</div>
              <ul className="footer-links">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <div>© 2025 BlockFlow. All rights reserved.</div>
            <div>Made with ❤️ in India</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
