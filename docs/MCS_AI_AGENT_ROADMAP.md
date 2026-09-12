# MCS AI Agent Roadmap

Architecture documentation for MCS Handymen Command Center AI agents.

**Status:** Validated architecture · documentation only · not implemented.  
**Do not implement** any agent, migration, or Phase 4A work from this file until an explicit GO.

## Current CRM checkpoints

| Phase | Commit | Scope |
| --- | --- | --- |
| Phase 3 | `c7f3c0f` | CRM dashboard, leads workflow, notes, history |
| Phase 3.5 | `8c66e9ed6ee52b684b5e6bb6b26eb96b6ff1de7b` | Customer profiles, email matching, tags, customer notes |

Phase 4+ work must remain additive and must not break the public website, quote form, auth, private photos, lead workflow, customer matching, or Neon schema already shipped.

---

## Architectural principles

| Layer | Role |
| --- | --- |
| **CRM** | Facts and source of truth (leads, customers, notes, tags, activity, status). |
| **MCS Playbook** | Validated knowledge and rules (services, area, policies, technical methods, pricing rules). |
| **Agents** | Analysis and proposals only. |
| **Critical actions** | Deterministic server execution **after** human approval. |

### Non-negotiable rules

1. Agents never silently mutate CRM truth.
2. Agents never invent prices, estimates, or critical technical specs from raw LLM knowledge.
3. Agents never auto-learn a new business rule from an LLM output.
4. Human corrections may later be **proposed** as Playbook candidates — never inserted without owner validation.
5. Prefer specialized agents over one mega-agent.
6. Each agent has: precise role, minimal required context, allow-listed tools, relevant Playbook slices, explicit limits, and approval gates for consequential actions.
7. Untrusted customer text (description, free-form notes) is never treated as system instructions (prompt-injection resistant design).

Pattern for consequential work:

```text
AI proposes → Human approves → Deterministic server action executes
```

---

## Agent catalog

### 1. Lead Agent

**Purpose:** Analyze and qualify inbound leads.

**Can propose:**

- Lead summary (fact-grounded)
- Missing information
- Questions to ask the customer
- Operational risk / ambiguity flags
- Complexity assessment (operational, not pricing)
- Suggested next action (alongside the existing deterministic CRM Next Action — does not replace it silently)
- Draft customer reply (display / copy only until approval gates exist)
- Relevant Customer Profile context (returning vs new, prior requests, operational tags, permanent notes) — tags as owner opinions, not absolute truth

**Phase 4A:** Read-only analysis only.

- May read authorized lead + customer CRM data
- May produce structured JSON validated server-side
- May persist analysis in a **separate** AI store (never into `lead_notes` / `customer_notes`)
- Must not change status, tags, notes, send messages, create estimates, or invent prices

---

### 2. MCS Playbook / Knowledge System

**Purpose:** Permanent, owner-validated knowledge base for MCS.

**Grow over time with:**

- MCS commercial rules
- Accepted / refused services
- Service area
- Policies
- Work procedures
- Validated technical standards
- MCS methods by service type
- Owner-approved knowledge only

**Governance:**

- Playbook is trusted context for agents when versioned and approved
- Human corrections can later be proposed as new knowledge entries
- **Never** auto-add LLM output as Playbook truth without owner validation
- Versioning and supersession required when content changes

**Suggested placement in roadmap:** Phase **4A.5** (after Lead Agent read-only, before Job Prep relies on deep technical procedures).

---

### 3. Job Prep / Technical Agent

**Purpose:** For a specific job, produce a preparation package grounded in real job characteristics and MCS-validated procedures.

**Outputs (when data allows):**

- Materials list
- Quantities
- Dimensions
- Screw size and length
- Anchor type / capacity when relevant
- Appropriate products
- Required tools
- Consumables
- Equipment / PPE when relevant
- Prep checklist
- Missing info to confirm before the job
- Main execution steps

**Dependency on real job characteristics.** Example — drywall:

- Damage dimensions
- Drywall thickness
- Available backing
- Tape type
- Compound type
- Setting-type / hot mud when relevant
- Set time
- Coat sequence
- Primer / paint
- Appropriate screws

**Limits:**

- Do not invent critical technical specifications
- Prefer MCS-validated procedures and available manufacturer specs
- Flag unknowns instead of guessing
- No autonomous purchasing or scheduling

---

### 4. Estimate / Pricing Agent — future

**Purpose:** Produce estimate inputs using **only** approved MCS pricing rules.

**Rules:**

- No prices invented by the LLM
- Interrogate structured MCS pricing / deterministic engines when they exist
- Source of truth for commercial minimums includes existing project constants (e.g. `MIN_SERVICE_CALL_USD` / **$125** minimum service call and related published commercial rules)
- Human approval before any customer-facing price is sent

---

### 5. Follow-up Agent — future

**Purpose:** Manage follow-ups according to MCS rules and CRM state.

**Limits:** Drafts and reminders only until approval; no autonomous customer messaging in early phases.

---

### 6. Scheduling / Dispatch Agent — future

**Purpose:** Prepare and assign interventions based on availability, skills, location, and job information.

**Limits:** Proposals only until approval; no silent calendar writes in early phases.

---

### 7. Marketing Agent — future

**Purpose:** Meta / Facebook / Instagram / Google attribution, analysis, and recommendations.

**Limits:**

- No autonomous ad budget changes
- No spend without human approval
- No silent campaign mutations

---

### 8. MCS Orchestrator — future

**Purpose:** Coordinate specialized agents.

**Anti-pattern:** One giant agent that does everything.

**Orchestrator responsibilities:**

- Route a request to the right specialist
- Assemble only the context each agent needs
- Enforce tool allow-lists and approval gates
- Merge proposals without collapsing CRM truth and Playbook truth

---

## Roadmap (ordered)

| Stage | Focus | Status |
| --- | --- | --- |
| **Phase 4A** | Lead Agent — read-only analysis on Lead Detail | Not started (needs explicit GO) |
| **Phase 4A.5** | MCS Playbook / Knowledge System foundations | Future |
| **Phase 4B** | Job Prep / Technical Agent | Future |
| **Later** | Estimate / Pricing Agent | Future |
| **Later** | Follow-up Agent | Future |
| **Later** | Scheduling / Dispatch Agent | Future |
| **Later** | Marketing Agent | Future |
| **Finally** | MCS Orchestrator | Future |

Within Lead Agent delivery (when approved), prefer small slices already outlined in architecture review:

- **4A** — structured analysis UI (summary, facts, missing info, questions, risks, complexity)
- **4B (Lead)** — draft reply + suggested next action (display / copy; no send/mutate)
- **4C (Lead)** — human approval gates into existing deterministic CRM actions
- **4D** — external connectors (email/Meta/etc.) behind approval gates only

Naming note: “Phase 4B” in the global MCS roadmap above means **Job Prep**. Lead-agent draft/approval slices remain sub-steps under Lead Agent delivery and must not be confused with Job Prep.

---

## Lead Agent — Phase 4A constraints (reminder)

When Phase 4A is approved to build:

- Owner-only routes / server actions
- On-demand analysis (button), not automatic on public quote ingest
- Structured JSON validated server-side
- Separate AI analysis storage (e.g. `ai_lead_analyses`) — never raw LLM text in human notes tables
- Deterministic CRM Next Action remains source of operational hint from status
- No pricing, no connectors, no silent status changes
- Preserve Phase 3 / 3.5 behavior

This document does **not** authorize implementation.

---

## Separation of stores (conceptual)

| Store | Contents |
| --- | --- |
| CRM tables | Leads, customers, human notes, tags, activity, statuses |
| Playbook | Owner-validated knowledge entries and rule versions |
| AI analyses / drafts | Model outputs, prompt version, fingerprints, supersession |
| Action proposals (later) | Pending/approved/rejected proposals for gated mutations |

---

## Document control

| Field | Value |
| --- | --- |
| Created for | MCS Handymen Command Center |
| Type | Architecture roadmap (docs only) |
| Implementation | None from this file without explicit GO |
| Related checkpoints | Phase 3 `c7f3c0f`, Phase 3.5 `8c66e9e` |
