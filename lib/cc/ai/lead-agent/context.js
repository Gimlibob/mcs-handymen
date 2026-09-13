import { createHash } from "node:crypto";
import { getCustomerRecurrence } from "../../domain/customer-match.js";
import { customerTagLabel } from "../../domain/customer-tags.js";
import { getNextAction, statusLabel } from "../../domain/lead-status.js";
import {
  getCustomerById,
  getCustomerLeadCount,
  getCustomerNotes,
  getCustomerServices,
  getCustomerTags,
} from "../../db/customers.js";
import { getLeadById, getLeadNotes } from "../../db/leads.js";
import { buildLeadAgentUserPrompt } from "./prompt.js";
import { retrieveApprovedPlaybookForLead } from "./playbook-retrieval.js";

function clip(text, max = 4000) {
  if (typeof text !== "string") return "";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncated]`;
}

function formatNotes(notes, { maxNotes = 8, bodyMax = 800 } = {}) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  return notes
    .slice(0, maxNotes)
    .map((n, i) => {
      const body = clip(n.body, bodyMax);
      const at = n.created_at ? new Date(n.created_at).toISOString() : "";
      return `#${i + 1} (${at}): ${body}`;
    })
    .join("\n\n");
}

/**
 * Load authorized CRM + approved Playbook context for Lead Agent. Does not include photos.
 * @returns {Promise<null | { lead, context, fingerprint, crmNextAction, userPrompt, playbookRevisionIds }>}
 */
export async function buildLeadAgentContext(leadId) {
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  const leadNotes = await getLeadNotes(lead.id);
  let customer = null;
  let customerNotes = [];
  let customerTags = [];
  let priorProjectTypes = [];
  let leadCount = 0;

  if (lead.customer_id) {
    const [profile, notes, tags, services, count] = await Promise.all([
      getCustomerById(lead.customer_id),
      getCustomerNotes(lead.customer_id),
      getCustomerTags(lead.customer_id),
      getCustomerServices(lead.customer_id),
      getCustomerLeadCount(lead.customer_id),
    ]);
    if (profile && !profile.merged_into_customer_id) {
      customer = profile;
      customerNotes = notes;
      customerTags = tags;
      priorProjectTypes = (services || []).map((s) => s.project_type).filter(Boolean);
      leadCount = count;
    }
  }

  const crmNextAction = getNextAction(lead.status);
  const tagLabels = customerTags.map((t) => customerTagLabel(t.tag_key));
  const recurrence = customer ? getCustomerRecurrence(leadCount) : "unknown";

  let playbook = { entries: [], revisionIds: [], text: "" };
  try {
    playbook = await retrieveApprovedPlaybookForLead(lead);
  } catch (error) {
    console.error("[cc/lead-agent] playbook retrieval failed", error?.message || error);
    playbook = { entries: [], revisionIds: [], text: "" };
  }

  const playbookRevisionIds = Array.isArray(playbook.revisionIds)
    ? [...playbook.revisionIds].map(String).sort()
    : [];

  const context = {
    leadId: lead.id,
    status: `${lead.status} (${statusLabel(lead.status)})`,
    crmNextAction,
    fullName: lead.full_name,
    email: lead.email,
    city: lead.city,
    propertyType: lead.property_type,
    projectType: lead.project_type,
    contactMethod: lead.contact_method,
    preferredDate: lead.preferred_date ? String(lead.preferred_date).slice(0, 10) : null,
    source: lead.source,
    createdAt: lead.created_at ? new Date(lead.created_at).toISOString() : "",
    updatedAt: lead.updated_at ? new Date(lead.updated_at).toISOString() : "",
    description: clip(lead.description, 6000),
    leadNotesText: formatNotes(leadNotes),
    customerNotesText: formatNotes(customerNotes),
    customer: customer
      ? {
          id: customer.id,
          recurrence,
          leadCount,
          tags: tagLabels,
          priorProjectTypes,
        }
      : null,
    playbookText: playbook.text || "",
    playbookRevisionIds,
  };

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        leadId: lead.id,
        status: lead.status,
        updatedAt: context.updatedAt,
        description: context.description,
        leadNotesText: context.leadNotesText,
        customerId: customer?.id || null,
        customerNotesText: context.customerNotesText,
        tags: tagLabels,
        leadCount,
        playbookRevisionIds,
      })
    )
    .digest("hex")
    .slice(0, 32);

  return {
    lead,
    context,
    fingerprint,
    crmNextAction,
    playbookRevisionIds,
    userPrompt: buildLeadAgentUserPrompt(context),
  };
}
