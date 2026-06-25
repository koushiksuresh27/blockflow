import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import BlockFlowHubSpoke from "../components/BlockFlowHubSpoke";

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const faqs = [
    { q: "Is BlockFlow really free?", a: "Yes — completely free during Hackhazards. We're launching a paid Growth plan later with advanced features, but core maintenance workflows stay free." },
    { q: "Do technicians need to download an app?", a: "They get task alerts via WhatsApp with no download needed. The full mobile dashboard adds photo uploads and performance tracking." },
    { q: "How does auto-assignment work?", a: "When a complaint comes in, BlockFlow matches it to the best available technician based on specialization, workload, and past performance — no manual work for the admin." },
    { q: "What makes Complaint DNA different from a normal ticketing system?", a: "Most systems treat every complaint as new. BlockFlow fingerprints each one, and when the same failure recurs, it's flagged as chronic with a root-cause ticket — before it becomes a bigger repair bill." },
    { q: "Can residents use voice in their own language?", a: "Yes. Speak your complaint in Hindi, Tamil, Telugu, or several other Indian languages — Sarvam AI transcribes it and the system auto-suggests category and priority." },
    { q: "Is my society's data private?", a: "Yes. BlockFlow never sells data or shows ads. We charge a subscription, not your privacy." }
  ];
  return (
    <div className="bg-[#EDEBE6] text-[#1C1917] font-body-md antialiased selection:bg-[#1C1917] selection:text-[#EDEBE6] relative min-h-screen">

      {/**/}
      <header className="fixed top-0 w-full z-40 border-b-2 border-[#1C1917] bg-[#EDEBE6]/90 backdrop-blur-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-1 text-[#1C1917]">
              <img src="/logo.png" alt="BlockFlow" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />  <span className="get-started-brand">BlockFlow</span>  </Link>
            <nav className="hidden md:flex items-center gap-6 font-code-sm text-[12px] uppercase tracking-wider">
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#product">[ Solution ]</a>
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#solutions">[ Features ]</a>
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#pricing">[ Pricing ]</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 font-code-sm text-[12px] uppercase tracking-wider">
            <Link className="hidden sm:block hover:underline underline-offset-4" to="/login">LOGIN</Link>
            <Link className="btn-primary px-4 py-2 font-bold" to="/onboarding">GET STARTED</Link>
          </div>
        </div>
      </header>
      <main className="pt-[80px]">
        {/**/}
        <section className="min-h-[90vh] relative overflow-hidden flex flex-col md:flex-row items-start border-b-2 border-[#1C1917]"><div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img alt="City Skyline Background" className="w-full h-full object-cover opacity-100" src="/hero-city.jpg" />
        </div>
          <div className="absolute inset-0 blueprint-bg pointer-events-none"></div>
          <div className="w-full md:w-1/2 p-6 md:p-8 z-10 fade-in-up relative pt-12 md:pt-6">
            <h1 className="font-display-lg text-3xl md:text-4xl font-bold text-[#1C1917] tracking-tight leading-none mb-6">
              The Operating System<br />for Modern<br />Residential Properties.
            </h1>
            <p className="font-body-md text-[#6a635e] max-w-md leading-relaxed mb-8 border-l-2 border-[#1C1917] pl-4 -mt-4">
              One platform to run your entire community.
            </p>
          </div>
          <div className="w-full md:w-1/2 h-[50vh] md:h-full min-h-[500px] border-t-2 md:border-t-0 md:border-l-2 border-[#1C1917] relative bg-[#1C1917]/5 flex items-center justify-center fade-in-up delay-200">
            <div className="w-full max-w-sm industrial-border bg-[#EDEBE6] p-6 shadow-[8px_8px_0_0_#1C1917]">
              <div className="flex justify-between items-center border-b-2 border-[#1C1917] pb-2 mb-4">
                <span className="font-code-sm text-[12px] font-bold">OVERVIEW</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-[#1C1917] rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-[#1C1917]/30 rounded-full"></div>
                  <div className="w-2 h-2 bg-[#1C1917]/30 rounded-full"></div>
                </div>
              </div>
              <BlockFlowHubSpoke />
            </div>
          </div>
        </section>
        {/**/}
        <section className="py-24 px-6 max-w-[1440px] mx-auto relative" id="product">
          <div className="font-code-sm text-[11px] text-[#1C1917]/70 mb-4 tracking-widest uppercase">The Problem</div>
          <h2 className="font-display-lg text-4xl mb-12 max-w-xl">Problems We're Solving</h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(250px,auto)]">

            <div className="md:col-span-8 industrial-border p-8 bg-[#1C1917] text-[#EDEBE6] flex flex-col justify-between fade-in-up">
              <div className="flex justify-between items-start">
                <span className="font-code-sm text-[12px] opacity-70 tracking-widest">01</span>
                <span className="material-symbols-outlined text-4xl">forum</span>
              </div>
              <div className="max-w-md mt-12">
                <h3 className="font-display-lg text-3xl mb-4 leading-tight">Complaints Get Lost</h3>
                <p className="font-code-sm text-sm opacity-80 leading-relaxed">Residents report issues over WhatsApp groups and phone calls. Nothing is tracked, nothing follows up, and the same problem gets reported five different ways.</p>
              </div>
            </div>

            <div className="md:col-span-4 md:row-span-2 industrial-border p-8 flex flex-col justify-between fade-in-up delay-100 bg-[#EDEBE6] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 blueprint-bg opacity-20"></div>
              <div className="flex justify-between items-start z-10">
                <span className="font-code-sm text-[12px] tracking-widest font-bold">02</span>
                <span className="material-symbols-outlined text-4xl text-[#1C1917]">block</span>
              </div>
              <div className="z-10 mt-12">
                <h3 className="font-display-lg text-2xl mb-4 leading-tight">Zero Accountability</h3>
                <p className="font-code-sm text-sm text-[#6a635e] leading-relaxed mb-8">Technicians work without formal assignments, proof of completion, or any way to measure performance.</p>
                <div className="border-2 border-[#1C1917] p-4 bg-white/50">
                  <div className="font-code-sm text-[10px] border-b border-[#1C1917]/20 pb-2 mb-2">RESULT</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-code-sm"><span>Disputes over "was it fixed"</span><span className="font-bold">HIGH</span></div>
                    <div className="flex justify-between text-[10px] font-code-sm opacity-50"><span>Trust in the system</span><span>LOW</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 industrial-border p-8 flex items-center gap-8 fade-in-up delay-200">
              <div className="flex-grow">
                <div className="font-code-sm text-[12px] tracking-widest font-bold mb-4">03</div>
                <h3 className="font-display-lg text-2xl mb-4 leading-tight">Recurring Issues Go Unnoticed</h3>
                <p className="font-code-sm text-sm text-[#6a635e] leading-relaxed max-w-sm">The same lift, the same pump, the same pipe — fixed over and over with nobody connecting the dots, until it fails for good.</p>
              </div>
              <div className="hidden sm:block w-48 h-32 border-2 border-[#1C1917] relative flex-shrink-0">
                <div className="absolute bottom-0 left-0 w-full h-[60%] border-t border-[#1C1917]/20 bg-[#1C1917]/5"></div>
                <div className="absolute bottom-0 left-4 w-6 h-[40%] bg-[#1C1917]/60"></div>
                <div className="absolute bottom-0 left-12 w-6 h-[55%] bg-[#1C1917]/60"></div>
                <div className="absolute bottom-0 left-20 w-6 h-[90%] bg-[#1C1917]"></div>
                <div className="absolute bottom-0 left-28 w-6 h-[30%] bg-[#1C1917]/40"></div>
              </div>
            </div>
          </div>
        </section>
        {/**/}
        <section className="pt-12 pb-12 border-y-2 border-[#1C1917] relative" id="solutions">
          <div className="absolute inset-0 blueprint-bg pointer-events-none"></div>
          <div className="max-w-[1440px] mx-auto px-6 relative z-10">
            <div className="font-code-sm text-[11px] text-[#1C1917]/70 mb-4 tracking-widest uppercase">The Platform</div>
            <h2 className="font-display-lg text-5xl leading-none mb-24 max-w-2xl">Built For Every Role</h2>

            {/* BLOCK 1 - ADMIN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-32">
              <div className="lg:col-span-4 sticky top-32 self-start hidden lg:block">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-3">For Admins</h3>
                <p className="font-code-sm text-sm text-[#6a635e] max-w-xs">Run the whole society without drowning in tickets.</p>
              </div>
              {/* Mobile header */}
              <div className="lg:hidden mb-6">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-2">For Admins</h3>
                <p className="font-code-sm text-sm text-[#6a635e]">Run the whole society without drowning in tickets.</p>
              </div>
              <div className="lg:col-span-8 space-y-8">
                {/* 01 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">01</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">fingerprint</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Complaint DNA</h4>
                    <p className="font-code-sm text-sm text-[#6a635e] mb-4">Every complaint is fingerprinted. When the same failure shows up three times, BlockFlow flags it as chronic and opens a root-cause ticket automatically.</p>
                    <div className="border border-[#1C1917] p-3 bg-white/50 font-code-sm text-[11px]">
                      <div className="flex justify-between border-b border-[#1C1917]/10 pb-1 mb-1"><span>CHRONIC ISSUE</span><span className="font-bold">LIFT_B · 3x/30d</span></div>
                      <div className="flex justify-between border-b border-[#1C1917]/10 pb-1 mb-1"><span>SLA COMPLIANCE</span><span className="font-bold">94%</span></div>
                      <div className="pt-1 italic">"Check Lift B today"</div>
                    </div>
                  </div>
                </div>
                {/* 02 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-100 ml-0 md:ml-8 lg:ml-12">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">02</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">smart_toy</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Aria, Your AI Co-pilot</h4>
                    <p className="font-code-sm text-sm text-[#6a635e]">A proactive daily briefing that reads your data and tells you what actually needs attention — not a chatbot that waits to be asked.</p>
                  </div>
                </div>
                {/* 03 */}
                <div className="industrial-border p-6 bg-[#1C1917] text-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-200 ml-0 md:ml-16 lg:ml-24">
                  <div className="font-display-lg text-5xl font-bold text-[#EDEBE6]/20 min-w-[60px]">03</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">document_scanner</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Vendor Intelligence</h4>
                    <p className="font-code-sm text-sm opacity-80">Upload a vendor contract or invoice. AI extracts the company, cost, and dates and fills in your vendor records for you.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* BLOCK 2 - RESIDENT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-32">
              <div className="lg:col-span-4 sticky top-32 self-start hidden lg:block">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-3">For Residents</h3>
                <p className="font-code-sm text-sm text-[#6a635e] max-w-xs">Report an issue in seconds, in your own language.</p>
              </div>
              {/* Mobile header */}
              <div className="lg:hidden mb-6">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-2">For Residents</h3>
                <p className="font-code-sm text-sm text-[#6a635e]">Report an issue in seconds, in your own language.</p>
              </div>
              <div className="lg:col-span-8 space-y-8">
                {/* 01 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">01</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">mic</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Voice Complaints</h4>
                    <p className="font-code-sm text-sm text-[#6a635e] mb-4">Speak in Hindi, Tamil, Telugu, or English. AI transcribes it and suggests the right category and priority automatically.</p>
                    <div className="border border-[#1C1917] p-3 bg-white/50">
                      <div className="font-body-sm text-sm mb-2 italic">"Bathroom mein pipe leak ho rahi hai"</div>
                      <div className="flex gap-2 font-code-sm text-[10px]">
                        <span className="border border-[#1C1917] px-2 py-1 bg-white">CAT: PLUMBING</span>
                        <span className="border border-[#1C1917] px-2 py-1 bg-[#1C1917] text-white">PRI: HIGH</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 02 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-100 ml-0 md:ml-8 lg:ml-12">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">02</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">photo_camera</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Real-time Tracking</h4>
                    <p className="font-code-sm text-sm text-[#6a635e]">Follow your complaint from submission to resolution, with before/after photo proof and the option to rate the work.</p>
                  </div>
                </div>
                {/* 03 */}
                <div className="industrial-border p-6 bg-[#1C1917] text-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-200 ml-0 md:ml-16 lg:ml-24">
                  <div className="font-display-lg text-5xl font-bold text-[#EDEBE6]/20 min-w-[60px]">03</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">groups</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Community Life</h4>
                    <p className="font-code-sm text-sm opacity-80">Book the clubhouse or gym, generate a gate pass for guests, or report a building-wide issue everyone in your block is dealing with.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* BLOCK 3 - TECHNICIAN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-8">
              <div className="lg:col-span-4 sticky top-32 self-start hidden lg:block">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-3">For Technicians</h3>
                <p className="font-code-sm text-sm text-[#6a635e] max-w-xs">Know exactly what to do next, from your phone.</p>
              </div>
              {/* Mobile header */}
              <div className="lg:hidden mb-6">
                <h3 className="font-headline-md text-3xl font-bold uppercase tracking-wider mb-2">For Technicians</h3>
                <p className="font-code-sm text-sm text-[#6a635e]">Know exactly what to do next, from your phone.</p>
              </div>
              <div className="lg:col-span-8 space-y-8">
                {/* 01 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">01</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">checklist</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Mobile Task Queue</h4>
                    <p className="font-code-sm text-sm text-[#6a635e] mb-4">Every job sorted by priority with a live SLA countdown. Accept, reject with a reason, or start work — all from your phone.</p>
                    <div className="border border-[#1C1917] p-3 bg-white/50 space-y-2 font-code-sm text-[11px]">
                      <div className="flex justify-between items-center border-b border-[#1C1917]/10 pb-1.5"><span>Water leak · 4B</span><span className="font-bold text-[#1C1917]">SLA 2h</span></div>
                      <div className="flex justify-between items-center pt-0.5"><span>Lift stuck · Tower B</span><span className="font-bold text-[#1C1917]/50">SLA 18h</span></div>
                    </div>
                  </div>
                </div>
                {/* 02 */}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-100 ml-0 md:ml-8 lg:ml-12">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">02</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">verified</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl">Photo Proof & Performance</h4>
                    <p className="font-code-sm text-sm text-[#6a635e]">Submit before/after photos on every job. Your rating and completion rate build automatically over time.</p>
                  </div>
                </div>
                {/* 03 */}
                <div className="industrial-border p-6 bg-[#1C1917] text-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-200 ml-0 md:ml-16 lg:ml-24">
                  <div className="font-display-lg text-5xl font-bold text-[#EDEBE6]/20 min-w-[60px]">03</div>
                  <div className="flex-grow">
                    <span className="material-symbols-outlined text-3xl mb-3 block">apartment</span>
                    <h4 className="font-headline-md font-bold mb-2 text-xl flex flex-wrap items-center gap-3">
                      Multi Community Workspace
                    </h4>
                    <p className="font-code-sm text-sm opacity-80">Work across more than one society from a single job queue.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
        {/**/}
        <section className="pt-12 pb-12 px-6 max-w-[1440px] mx-auto" id="pricing">
          <div className="font-code-sm text-[11px] text-[#1C1917]/70 mb-4 tracking-widest uppercase">Pricing</div>
          <h2 className="font-display-lg text-4xl mb-12 text-center">Simple, Honest Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            <div className="border-2 border-[#1C1917] p-8 flex flex-col relative fade-in-up">
              <div className="font-code-sm text-[12px] font-bold tracking-widest mb-2">FREE</div>
              <div className="mb-8 border-b-2 border-[#1C1917] pb-4">
                <span className="font-display-lg text-4xl">Free for Hackhazards</span>
              </div>
              <ul className="space-y-3 mb-12 flex-grow font-code-sm text-sm">
                <li className="flex items-center gap-2">[+] Complaint tracking & auto-assignment</li>
                <li className="flex items-center gap-2">[+] Complaint DNA pattern detection</li>
                <li className="flex items-center gap-2">[+] Aria, your AI co-pilot</li>
                <li className="flex items-center gap-2">[+] Voice complaints in regional languages</li>
                <li className="flex items-center gap-2">[+] Gate pass & community board</li>
              </ul>
              <a href="/onboarding" className="w-full btn-secondary py-3 font-code-sm font-bold uppercase tracking-wider text-center">Get Started</a>
            </div>

            <div className="industrial-border p-8 flex flex-col bg-[#1C1917] text-[#EDEBE6] fade-in-up delay-100 relative">
              <div className="absolute top-0 right-0 bg-[#EDEBE6] text-[#1C1917] font-code-sm text-[10px] px-2 py-1 font-bold border-l-2 border-b-2 border-[#1C1917]">LAUNCHING SOON</div>
              <div className="font-code-sm text-[12px] font-bold tracking-widest mb-2 text-[#EDEBE6]/70">GROWTH</div>
              <div className="mb-8 border-b-2 border-[#EDEBE6]/20 pb-4">
                <span className="font-display-lg text-4xl">Coming Soon</span>
              </div>
              <ul className="space-y-3 mb-12 flex-grow font-code-sm text-sm opacity-90">
                <li className="flex items-center gap-2">[+] Unlimited residents</li>
                <li className="flex items-center gap-2">[+] Multi-community workspace</li>
                <li className="flex items-center gap-2">[+] Advanced analytics</li>
                <li className="flex items-center gap-2">[+] Priority support</li>
              </ul>
              <button disabled className="w-full bg-[#EDEBE6]/20 text-[#EDEBE6]/60 py-3 font-code-sm font-bold uppercase tracking-wider border-2 border-[#EDEBE6]/30 cursor-not-allowed">Notify Me</button>
            </div>
          </div>
        </section>
        {/**/}
        <section className="pt-12 pb-24 px-6 max-w-[1440px] mx-auto" id="faq">
          <div className="font-code-sm text-[11px] text-[#1C1917]/70 mb-4 tracking-widest uppercase">FAQ</div>
          <h2 className="font-display-lg text-4xl mb-12 max-w-xl">Common Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
            {faqs.map((item, i) => (
              <div key={i} className="industrial-border bg-[#EDEBE6]">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex justify-between items-center text-left p-5"
                >
                  <span className="font-headline-md font-bold text-base pr-4">{item.q}</span>
                  <span className="material-symbols-outlined flex-shrink-0">
                    {openFaq === i ? 'remove' : 'add'}
                  </span>
                </button>
                {openFaq === i && (
                  <p className="font-code-sm text-sm text-[#6a635e] px-5 pb-5 leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <footer className="border-t-2 border-[#1C1917] bg-[#EDEBE6] pt-12 pb-6 px-6 relative overflow-hidden">
          <div className="absolute inset-0 blueprint-bg pointer-events-none"></div>
          <div className="max-w-[1440px] mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <div className="get-started-brand">BlockFlow</div>
              <p className="font-code-sm text-[10px] text-[#6a635e] max-w-xs">Built for the people who keep communities running.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 font-code-sm text-[12px] uppercase">
              <div className="flex flex-col gap-2">
                <span className="font-bold mb-2 border-b border-[#1C1917] w-min">Nav</span>
                <a className="hover:underline" href="#product">Product</a>
                <a className="hover:underline" href="#solutions">Solutions</a>
                <a className="hover:underline" href="#pricing">Pricing</a>
              </div>
            </div>
          </div>
          <div className="max-w-[1440px] mx-auto mt-12 pt-6 border-t border-[#1C1917]/20 flex justify-between items-center font-code-sm text-[10px] text-[#6a635e]">
            <span>© 2026 BLOCKFLOW</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
