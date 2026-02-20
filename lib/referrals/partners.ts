import { db } from "@/lib/db";
import {
  referralPartners,
  referralOpportunities,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit/logger";
import { getConfigForPractice } from "@/lib/industries";
import type { ReferralPartner } from "@/lib/db/schema";

export interface DefaultPartner {
  name: string;
  category: string;
  description: string;
  contactEmail: string;
  website: string;
  regions: string[];
  industries: string[];
}

export const DEFAULT_PARTNERS: DefaultPartner[] = [
  {
    name: "PracticeFinance Lending",
    category: "lender",
    description:
      "Specialized small business and practice loans with competitive rates. SBA, equipment, and commercial real estate financing.",
    contactEmail: "partners@practicefinance.example.com",
    website: "https://practicefinance.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
  {
    name: "PracticeShield Insurance",
    category: "insurance",
    description:
      "Comprehensive business insurance solutions including malpractice, liability, property, and workers compensation coverage.",
    contactEmail: "quotes@practiceshield.example.com",
    website: "https://practiceshield.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
  {
    name: "SmartTax Advisors",
    category: "cpa",
    description:
      "CPA firm specializing in small business and healthcare practice tax strategy, entity structuring, and retirement planning.",
    contactEmail: "consult@smarttaxadvisors.example.com",
    website: "https://smarttaxadvisors.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
  {
    name: "Pinnacle Wealth Management",
    category: "financial_advisor",
    description:
      "Financial planning and wealth management tailored to practice owners. Retirement planning, investment management, and estate planning.",
    contactEmail: "advisors@pinnaclewealth.example.com",
    website: "https://pinnaclewealth.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
  {
    name: "PracticeTransitions Group",
    category: "broker",
    description:
      "Practice sales, acquisitions, and transition consulting. Valuation, buyer matching, and deal negotiation services.",
    contactEmail: "transitions@ptgroup.example.com",
    website: "https://ptgroup.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
  {
    name: "MedEquip Capital",
    category: "equipment_financing",
    description:
      "Equipment financing and leasing for healthcare practices. Flexible terms, Section 179 optimized, fast approvals.",
    contactEmail: "financing@medequipcapital.example.com",
    website: "https://medequipcapital.example.com",
    regions: ["nationwide"],
    industries: ["dental", "chiropractic", "veterinary", "general"],
  },
];

/**
 * Seed default partners into the database if none exist.
 */
export async function ensureDefaultPartners(): Promise<void> {
  const existing = await db
    .select({ id: referralPartners.id })
    .from(referralPartners)
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(referralPartners).values(
    DEFAULT_PARTNERS.map((p) => ({
      name: p.name,
      category: p.category,
      description: p.description,
      contactEmail: p.contactEmail,
      website: p.website,
      regions: p.regions,
      industries: p.industries,
      isActive: true,
    }))
  );
}

/**
 * Match a partner by category and practice industry.
 * Returns the best matching active partner, or null.
 */
export async function matchPartner(
  practiceId: string,
  partnerCategory: string
): Promise<ReferralPartner | null> {
  // Get practice industry for matching
  const config = await getConfigForPractice(practiceId);
  const industry = config.slug;

  // Find active partners in this category
  const partners = await db
    .select()
    .from(referralPartners)
    .where(
      and(
        eq(referralPartners.category, partnerCategory),
        eq(referralPartners.isActive, true)
      )
    );

  if (partners.length === 0) return null;

  // Prefer partner that lists this industry (or "general" / "nationwide")
  const industryMatch = partners.find(
    (p) =>
      p.industries?.includes(industry) || p.industries?.includes("general")
  );

  return industryMatch || partners[0];
}

/**
 * Get all active partners.
 */
export async function getPartners(): Promise<ReferralPartner[]> {
  return db
    .select()
    .from(referralPartners)
    .where(eq(referralPartners.isActive, true))
    .orderBy(referralPartners.category);
}

/**
 * Track a referral: update opportunity status, set partner and referred timestamp.
 */
export async function trackReferral(
  opportunityId: string,
  partnerId: string,
  userId: string,
  practiceId: string
): Promise<void> {
  const now = new Date();

  await db
    .update(referralOpportunities)
    .set({
      status: "referred",
      matchedPartnerId: partnerId,
      referredAt: now,
    })
    .where(
      and(
        eq(referralOpportunities.id, opportunityId),
        eq(referralOpportunities.practiceId, practiceId)
      )
    );

  await logAuditEvent({
    practiceId,
    userId,
    action: "referral_created",
    entityType: "referral_opportunity",
    entityId: opportunityId,
    newValue: { partnerId, referredAt: now.toISOString() },
  });
}
