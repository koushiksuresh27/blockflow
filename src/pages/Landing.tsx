import React from 'react';
import './Landing.css';
import BlockFlowHubSpoke from "../components/BlockFlowHubSpoke";

export default function Landing() {
  return (
    <div className="bg-[#EDEBE6] text-[#1C1917] font-body-md antialiased selection:bg-[#1C1917] selection:text-[#EDEBE6] relative min-h-screen">

      {/**/}
      <header className="fixed top-0 w-full z-40 border-b-2 border-[#1C1917] bg-[#EDEBE6]/90 backdrop-blur-sm">
        <div className="flex justify-between items-center px-6 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <a className="font-headline-md font-bold tracking-tight text-[#1C1917] uppercase" href="#">BlockFlow</a>
            <nav className="hidden md:flex items-center gap-6 font-code-sm text-[12px] uppercase tracking-wider">
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#product">[ Product ]</a>
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#solutions">[ Solutions ]</a>
              <a className="text-[#1C1917] hover:opacity-70 transition-opacity" href="#pricing">[ Pricing ]</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 font-code-sm text-[12px] uppercase tracking-wider">
            <a className="hidden sm:block hover:underline underline-offset-4" href="#demo">LOGIN</a>
            <a className="btn-primary px-4 py-2 font-bold" href="#start">GET STARTED</a>
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
        <section className="py-12 border-b-2 border-[#1C1917] relative overflow-hidden">
          <div className="text-texture-horizontal top-0 left-0">TRUSTED_PARTNERS</div>
          <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 z-10 relative">
            <div className="font-code-sm text-[12px] uppercase tracking-widest font-bold whitespace-nowrap">Integrated By //</div>
            <div className="flex flex-wrap justify-center items-center gap-12 flex-grow">
              <div className="font-headline-md font-bold text-2xl tracking-tighter uppercase border-b-4 border-[#1C1917]">AcmeProp</div>
              <div className="font-headline-md font-bold text-2xl tracking-tighter uppercase border-b-4 border-[#1C1917]/50">NexusEstate</div>
              <div className="font-headline-md font-bold text-2xl tracking-tighter uppercase border-b-4 border-[#1C1917]/50">Urbane</div>
              <div className="font-headline-md font-bold text-2xl tracking-tighter uppercase border-b-4 border-[#1C1917]/50">SkylineMgmt</div>
            </div>
          </div>
        </section>
        {/**/}
        <section className="py-24 px-6 max-w-[1440px] mx-auto relative" id="product">
          <div className="font-code-sm text-[10px] text-[#1C1917]/70 mb-8 tracking-widest">SEQ: 002_CAPABILITIES</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(250px,auto)]">
            {/**/}
            <div className="md:col-span-8 industrial-border p-8 bg-[#1C1917] text-[#EDEBE6] flex flex-col justify-between group hover:bg-[#1C1917]/95 transition-colors fade-in-up">
              <div className="flex justify-between items-start">
                <span className="font-code-sm text-[12px] opacity-70 tracking-widest">FT.01</span>
                <span className="material-symbols-outlined text-4xl">smart_toy</span>
              </div>
              <div className="max-w-md mt-12">
                <h3 className="font-display-lg text-3xl mb-4 leading-tight">AI Complaint Routing</h3>
                <p className="font-code-sm text-sm opacity-80 leading-relaxed">Convert multilingual messages from residents into structured, prioritized work orders automatically. Pattern recognition handles ambiguities.</p>
              </div>
            </div>
            {/**/}
            <div className="md:col-span-4 md:row-span-2 industrial-border p-8 flex flex-col justify-between fade-in-up delay-100 bg-[#EDEBE6] relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 blueprint-bg opacity-20"></div>
              <div className="flex justify-between items-start z-10">
                <span className="font-code-sm text-[12px] tracking-widest font-bold">FT.02</span>
                <span className="material-symbols-outlined text-4xl text-[#1C1917]">route</span>
              </div>
              <div className="z-10 mt-12">
                <h3 className="font-display-lg text-2xl mb-4 leading-tight">Smart Dispatch Algorithm</h3>
                <p className="font-code-sm text-sm text-[#6a635e] leading-relaxed mb-8">Intelligently route tasks to the right technician based on specialized skills, location, and current availability.</p>
                {/**/}
                <div className="border-2 border-[#1C1917] p-4 bg-white/50">
                  <div className="font-code-sm text-[10px] border-b border-[#1C1917]/20 pb-2 mb-2">MATCHING_MATRIX</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-code-sm"><span>TECH_A (PLUMB)</span><span className="text-[#1C1917] font-bold">98% MATCH</span></div>
                    <div className="flex justify-between text-[10px] font-code-sm opacity-50"><span>TECH_B (HVAC)</span><span>12% MATCH</span></div>
                  </div>
                </div>
              </div>
            </div>
            {/**/}
            <div className="md:col-span-8 industrial-border p-8 flex items-center gap-8 fade-in-up delay-200">
              <div className="flex-grow">
                <div className="font-code-sm text-[12px] tracking-widest font-bold mb-4">FT.03</div>
                <h3 className="font-display-lg text-2xl mb-4 leading-tight">Real-time Analytics</h3>
                <p className="font-code-sm text-sm text-[#6a635e] leading-relaxed max-w-sm">Track maintenance performance metrics, resolution times, and overall resident satisfaction in one unified view.</p>
              </div>
              <div className="hidden sm:block w-48 h-32 border-2 border-[#1C1917] relative flex-shrink-0">
                <div className="absolute bottom-0 left-0 w-full h-[60%] border-t border-[#1C1917]/20 bg-[#1C1917]/5"></div>
                <div className="absolute bottom-0 left-4 w-6 h-[80%] bg-[#1C1917]"></div>
                <div className="absolute bottom-0 left-12 w-6 h-[40%] bg-[#1C1917]/60"></div>
                <div className="absolute bottom-0 left-20 w-6 h-[90%] bg-[#1C1917]"></div>
                <div className="absolute bottom-0 left-28 w-6 h-[30%] bg-[#1C1917]/40"></div>
              </div>
            </div>
          </div>
        </section>
        {/**/}
        <section className="py-24 border-y-2 border-[#1C1917] relative" id="solutions">
          <div className="absolute inset-0 blueprint-bg pointer-events-none"></div>
          <div className="max-w-[1440px] mx-auto px-6 relative z-10">
            <div className="font-code-sm text-[10px] text-[#1C1917]/70 mb-12 tracking-widest">SEQ: 003_PIPELINE</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="sticky top-32 self-start hidden lg:block">
                <h2 className="font-display-lg text-6xl leading-none mb-6">Execution<br />Flow</h2>
                <div className="w-24 h-2 bg-[#1C1917]"></div>
                <p className="font-code-sm mt-6 max-w-xs text-[#6a635e]">A seamless, deterministic pipeline from unstructured complaint to resolved work order.</p>
              </div>
              <div className="space-y-8">
                {/**/}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">01</div>
                  <div className="flex-grow">
                    <h4 className="font-headline-md font-bold uppercase tracking-wider mb-2">Resident Input</h4>
                    <p className="font-code-sm text-sm text-[#6a635e] mb-4">Issue reported via text, app, or voice.</p>
                    <div className="border border-[#1C1917] p-3 bg-white/50 inline-block font-body-sm">
                      "The sink in unit 4B is leaking badly under the cabinet."
                    </div>
                  </div>
                </div>
                {/**/}
                <div className="industrial-border p-6 bg-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-100 ml-0 md:ml-12">
                  <div className="font-display-lg text-5xl font-bold text-[#1C1917]/20 min-w-[60px]">02</div>
                  <div className="flex-grow">
                    <h4 className="font-headline-md font-bold uppercase tracking-wider mb-2">AI Structuring</h4>
                    <p className="font-code-sm text-sm text-[#6a635e] mb-4">Categorizes, prioritizes, and assigns details.</p>
                    <div className="grid grid-cols-2 gap-2 border border-[#1C1917] p-3 bg-white/50 font-code-sm text-[11px]">
                      <div className="border-b border-[#1C1917]/20 pb-1">TYPE: <span className="font-bold">PLUMBING</span></div>
                      <div className="border-b border-[#1C1917]/20 pb-1 text-right">PRIORITY: <span className="font-bold">HIGH</span></div>
                      <div className="pt-1">LOC: <span className="font-bold">UNIT_4B</span></div>
                    </div>
                  </div>
                </div>
                {/**/}
                <div className="industrial-border p-6 bg-[#1C1917] text-[#EDEBE6] flex flex-col md:flex-row gap-6 items-start fade-in-up delay-200 ml-0 md:ml-24">
                  <div className="font-display-lg text-5xl font-bold text-[#EDEBE6]/20 min-w-[60px]">03</div>
                  <div className="flex-grow">
                    <h4 className="font-headline-md font-bold uppercase tracking-wider mb-2">Tech Dispatch</h4>
                    <p className="font-code-sm text-sm opacity-80 mb-4">Actionable task pushed to technician device.</p>
                    <div className="border border-[#EDEBE6]/20 p-3 flex items-center gap-4">
                      <div className="w-10 h-10 border border-[#EDEBE6]/50 overflow-hidden bg-[#EDEBE6]/10">
                        {/**/}
                        <div className="w-full h-full flex items-center justify-center font-code-sm text-[8px] text-center">IMG_SRC</div>
                      </div>
                      <div className="font-code-sm text-[10px]">
                        <div className="font-bold">WO-842 // ASSIGNED: MIKE_T</div>
                        <div className="opacity-70 mt-1">ETA: 15m | TOOLS: WRENCH_SET</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/**/}
        <section className="py-24 px-6 max-w-[1440px] mx-auto" id="pricing">
          <div className="font-code-sm text-[10px] text-[#1C1917]/70 mb-12 tracking-widest">SEQ: 004_DEPLOYMENT_TIERS</div>
          <h2 className="font-display-lg text-4xl mb-12 text-center">System Requirements</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/**/}
            <div className="border-2 border-[#1C1917] p-8 flex flex-col relative fade-in-up">
              <div className="font-code-sm text-[12px] font-bold tracking-widest mb-2">TIER_01 // STARTER</div>
              <div className="mb-8 border-b-2 border-[#1C1917] pb-4">
                <span className="font-display-lg text-5xl">$199</span>
                <span className="font-code-sm text-[12px]">/MO</span>
              </div>
              <ul className="space-y-3 mb-12 flex-grow font-code-sm text-sm">
                <li className="flex items-center gap-2">[+] Up to 500 units</li>
                <li className="flex items-center gap-2">[+] Basic AI routing</li>
                <li className="flex items-center gap-2">[+] Standard support</li>
              </ul>
              <button className="w-full btn-secondary py-3 font-code-sm font-bold uppercase tracking-wider">Initialize</button>
            </div>
            {/**/}
            <div className="industrial-border p-8 flex flex-col bg-[#1C1917] text-[#EDEBE6] fade-in-up delay-100 transform md:-translate-y-4">
              <div className="absolute top-0 right-0 bg-[#EDEBE6] text-[#1C1917] font-code-sm text-[10px] px-2 py-1 font-bold border-l-2 border-b-2 border-[#1C1917]">RECOMMENDED</div>
              <div className="font-code-sm text-[12px] font-bold tracking-widest mb-2 text-[#EDEBE6]/70">TIER_02 // PRO</div>
              <div className="mb-8 border-b-2 border-[#EDEBE6]/20 pb-4">
                <span className="font-display-lg text-5xl">$499</span>
                <span className="font-code-sm text-[12px]">/MO</span>
              </div>
              <ul className="space-y-3 mb-12 flex-grow font-code-sm text-sm opacity-90">
                <li className="flex items-center gap-2">[+] Up to 2,000 units</li>
                <li className="flex items-center gap-2">[+] Advanced AI dispatch</li>
                <li className="flex items-center gap-2">[+] Real-time Analytics</li>
                <li className="flex items-center gap-2">[+] Priority routing</li>
              </ul>
              <button className="w-full bg-[#EDEBE6] text-[#1C1917] hover:bg-[#EDEBE6]/90 transition-colors py-3 font-code-sm font-bold uppercase tracking-wider border-2 border-[#EDEBE6]">Deploy System</button>
            </div>
            {/**/}
            <div className="border-2 border-[#1C1917] p-8 flex flex-col relative fade-in-up delay-200">
              <div className="font-code-sm text-[12px] font-bold tracking-widest mb-2">TIER_03 // ENTERPRISE</div>
              <div className="mb-8 border-b-2 border-[#1C1917] pb-4">
                <span className="font-display-lg text-5xl">CUST</span>
              </div>
              <ul className="space-y-3 mb-12 flex-grow font-code-sm text-sm">
                <li className="flex items-center gap-2">[+] Unlimited units</li>
                <li className="flex items-center gap-2">[+] API Access</li>
                <li className="flex items-center gap-2">[+] Dedicated Architect</li>
              </ul>
              <button className="w-full btn-secondary py-3 font-code-sm font-bold uppercase tracking-wider">Contact_Sales</button>
            </div>
          </div>
        </section>
        {/**/}
        <footer className="border-t-2 border-[#1C1917] bg-[#EDEBE6] pt-12 pb-6 px-6 relative overflow-hidden">
          <div className="absolute inset-0 blueprint-bg pointer-events-none"></div>
          <div className="max-w-[1440px] mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <div className="font-display-lg text-2xl font-bold uppercase mb-2">BlockFlow_</div>
              <p className="font-code-sm text-[10px] text-[#6a635e] max-w-xs">SYS.END // Engineering reliability for property teams. All sequences terminated gracefully.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 font-code-sm text-[12px] uppercase">
              <div className="flex flex-col gap-2">
                <span className="font-bold mb-2 border-b border-[#1C1917] w-min">Nav</span>
                <a className="hover:underline" href="#product">Product</a>
                <a className="hover:underline" href="#solutions">Solutions</a>
                <a className="hover:underline" href="#pricing">Pricing</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-bold mb-2 border-b border-[#1C1917] w-min">Legal</span>
                <a className="hover:underline" href="#">Privacy_Pol</a>
                <a className="hover:underline" href="#">Terms_Cond</a>
              </div>
            </div>
          </div>
          <div className="max-w-[1440px] mx-auto mt-12 pt-6 border-t border-[#1C1917]/20 flex justify-between items-center font-code-sm text-[10px] text-[#6a635e]">
            <span>© 2024 BLOCKFLOW</span>
            <span>STATUS: ONLINE</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
