<img width="4320" height="1440" alt="hh26 main poster 2 with sponsors 3x1 (4320 x 1440 px) (2)" src="https://github.com/user-attachments/assets/c698b2cd-da84-4cb0-9276-125c6a7244aa" />
# 🚀 BlockFlow
 
> Every complaint heard. Every technician deployed. Every pattern caught. Automatically.
 
---
 
## 📌 Problem & Domain
 
Most Indian housing societies run their entire maintenance operation through WhatsApp groups, paper registers, and phone calls. Complaints get lost, technicians work with zero accountability, and the same lift or water pump quietly fails three or four times before anyone connects the dots until it breaks for good and costs lakhs to replace instead of a few thousand to fix early.
 
**Themes Selected (at least one):**
- [ ] Human Experience & Productivity  
- [ ] Climate & Sustainability Systems  
- [ ] HealthTech & Bio Platforms  
- [ ] Learning & Knowledge Systems  
- [ ] Work, Finance & Digital Economy  
- [x] Infrastructure, Mobility & Smart Systems  
- [ ] Trust, Identity & Security  
- [ ] Media, Social & Interactive Platforms  
- [ ] Public Systems, Governance and Civic Tech  
- [ ] Developer Tools & Software Infrastructure  
---
 
## 🎯 Objective
 
BlockFlow is an end to end residential operations platform serving four distinct users in every housing society:
 
- **Residents** — submit complaints by voice in their own language, track resolution in real time, book amenities, generate gate passes, and report shared/community issues.
- **Technicians** — get a mobile first task queue with live SLA countdowns, submit before/after photo proof, and walk through hands free voice guided safety audits on critical equipment.
- **Security** — verify OTP-based gate passes, log visitors and staff, and raise emergency alerts.
- **Estate Managers (Admins)** — run the whole society from one dashboard, backed by an AI system that detects recurring infrastructure failures before they become expensive, and an AI assistant that can directly assign complaints on their behalf.
**The pain point:** existing society management apps are ticket loggers, cluttered with ads and unnessary features. None of them detect patterns, none speak Indian languages natively, and none give an admin anything close to an AI assistant that understands their building.
 
**The value:** BlockFlow turns months of WhatsApp group chaos into one platform where a recurring lift failure gets automatically flagged as chronic and forked into a root cause investigation ticket before the lift fails completely.
 
---
 
## 🧠 Team & Approach
 
### Team Name:  
`[HACK TO THE FUTURE]`
 
### Team Members:  
- Koushik S — `[https://github.com/koushiksuresh27/ / https://www.linkedin.com/in/koushik-s-26b110278/]`

### Your Approach:
- Chose this problem because apartment maintenance in India is a universal, lived pain point with almost no good software addressing it most "society apps" are directories and notice boards, not operations platforms.
- Key challenge: telling a single building wide outage apart from a genuinely recurring fault, so the pattern detection engine doesn't cry wolf every time one pump failure generates ten complaints in an hour.
- Breakthrough: discovering Sarvam AI's Document Intelligence API could turn a photographed vendor contract directly into structured database records extending Sarvam's role from a single voice input feature into a genuinely central, multi modal part of the product.
---
 
## 🛠️ Tech Stack
 
### Core Technologies Used:
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Iconoir (icons), Recharts (analytics)
- **Backend:** Node.js, Express 
- **Database:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **APIs:** 
  - Sarvam AI — Speech to Text (`saarika:v2.5`), Text to Speech (`bulbul:v2`), Document Intelligence/Vision (OCR), Language Identification and Translation.
  - Groq — `llama-3.3-70b-versatile` for complaint triage, pattern fingerprinting, structured data extraction.
  - Google OAuth — authentication across all four roles
- **Hosting:** Vercel (frontend), Render (backend workflow server)
### Additional Technologies Used (Optional):
- [x] AI / ML  
- [ ] Web3 / Blockchain  
- [ ] Cyber Security 
- [x] Cloud  
---
 
## 🏆 Sponsored Track (Optional)
 
- [ ] **Expo Track** – Built using Expo  
- [ ] **Neo4j Track** – Uses AuraDB as primary database  
- [ ] **Base44 Track** – Prototype/Final Product built using Base44  
- [x] **Sarvam Track** – Build using Sarvam API's  
### Explanation:
BlockFlow integrates multiple Sarvam AI APIs across the resident, technician, and admin workflows:

- **Speech to Text (`saarika:v2.5`)** enables residents to submit complaints in Hindi, Kannada, Tamil, Telugu, and English using voice. It also powers technicians' hands free responses during voice guided equipment audits.
- **Text to Speech (`bulbul:v2`)** narrates maintenance SOP instructions aloud, allowing technicians to complete inspections without touching their devices.
- **Translate (`mayura:v1`)** translates English maintenance SOPs into the technician's preferred Indian language before they are spoken aloud and also translate resident complaints to the set language.
- **Document Intelligence (OCR)** extracts information from photographed vendor contracts and invoices, enabling one click import of structured vendor records.
- **Language Identification** automatically detects the language of residents' voice complaints and chatbot messages, eliminating the need to manually select a language before transcription, translation, or AI processing.
- Together, Sarvam's language and document AI capabilities power BlockFlow's multilingual experience, while Groq handles reasoning and Supabase provides real time data synchronization across all user roles.

---
 
## ✨ Key Features
 
- ✅ **Complaint DNA Predictive Maintenance Engine.** Every complaint is fingerprinted by an LLM and clustered to tell a single building wide incident apart from a genuinely recurring failure, weighted against asset criticality. Chronic issues automatically fork into a root cause investigation ticket for the facility manager without blocking the resident's original complaint from closing.
- ✅ **Aria — AI Estate Manager Assistant.** A proactive daily briefing and conversational assistant (powered by Groq tool calling) that reads live society data and flags what actually needs attention,  including full voice conversation in the admin's preferred language via Sarvam STT/TTS.
- ✅ **Voice First Complaint Submission.** Residents speak their complaint in Hindi, Kannada, Tamil, Telugu, or English; Sarvam AI transcribes it, and an LLM auto suggests category and priority.
- ✅ **Smart Auto Assignment & SLA Tracking.** AI triage matches every complaint to the best available technician by specialization and notifies the technician instantly within the app.
- ✅ **Vendor Document Import.** Admins photograph an existing vendor contract or invoice; Sarvam Vision extracts the layout and Groq structures it into clean vendor records turning a manual data entry chore into a 20 second scan.
- ✅ **Voice Guided Equipment Audits.** Technicians run hands free safety checklists on critical assets (generators, water pumps) Sarvam TTS reads each step aloud, the technician answers by voice, Sarvam STT transcribes it, and an LLM validates the response before auto advancing to the next step.
- ✅ **Full Role Based Operations Suite.** Gate pass generation with OTP verification, amenity booking, community wide shared issue reporting, visitor/staff logging, and an invite link based resident onboarding flow with admin approval.
---
 
## 📽️ Demo & Deliverables
 
- **Demo Video Link (Mandatory):** `[https://www.loom.com/share/769a9b07976e4fb09a6b7b82b1c1a7f6]`  
- **Deployment Link (Recommended):** `[https://blockflow-eight.vercel.app/]`  
- **Pitch Deck / PPT (Optional):** `[https://pitch.com/v/blockflow-b6eexr]`  
---
 
## ✅ Tasks & Bonus Checklist
 
- [x] All team members completed the mandatory social task  
- [x] Bonus Task 1 – Badge sharing  
- [ ] Bonus Task 2 – Blog/article  
---
 
## 🧪 How to Run the Project
 
### Requirements:
- Node.js 18+
- A Supabase project (PostgreSQL + Auth)
- API keys: Sarvam AI, Groq, Google OAuth credentials
### Local Setup:
```bash
# Clone the repo
git clone <your-repo-url>
cd blockflow
 
# Install frontend dependencies
npm install
 
# Create .env.local in the project root with:
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_WORKFLOW_URL=http://localhost:3001
 
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
GROQ_API_KEY=your-groq-key
SARVAM_API_KEY=your-sarvam-key
PORT=3001
 
# Run the database migrations / SQL setup in your Supabase project
# (schema files in /sql or as documented in the repo)
 
# Terminal 1 — start the frontend
npm run dev
 
# Terminal 2 — start the backend workflow server
node workflow-server.js
```
 

 
---
 
## 🧬 Future Scope
 
- 📈 Proper Render Workflows SDK integration for the complaint resolution and SLA escalation pipelines, with full visual execution tracing.
- 🤖 Exploring a fully Sarvam native stack replacing Groq with Sarvam's own LLM so the entire AI layer runs on one provider.
- 🏢 Multi community technician workspace letting one technician work across several societies from a single job queue.
- 🅿️ Resident guest-parking booking and an admin managed parking slot pool.
- 📄 Legacy paper log digitization and an AI narrated maintenance bill explainer, both extending the existing Sarvam Vision pipeline.
- 💳 A monetized Growth plan unlocking expanded AI assistant capabilities for societies that want a more hands-off operator.
---
 
## 📎 Resources / Credits
 
- [Sarvam AI](https://www.sarvam.ai/) — Speech to Text, Text to Speech, and Document Intelligence APIs
- [Groq](https://groq.com/) — LLM inference (Llama 3.3 70B)
- [Supabase](https://supabase.com/) — Database, Auth, Realtime, Storage
- [Iconoir](https://iconoir.com/) — icon set
- Claude(Free tier)/Antigravity IDE — AI assisted code editor used to implement and debug the build
---
 
## 🏁 Final Words
 
Building BlockFlow showed how AI can simplify everyday residential operations. Looking forward to making it even more intelligent, scalable, and impactful.
