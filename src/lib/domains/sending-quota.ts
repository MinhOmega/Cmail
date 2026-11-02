import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, outboundJobs } from "@/db/schema";
import { findZoneByHostname, getEmailRoutingSettings } from "@/lib/cloudflare-api";
import { hasCloudflareCredentials } from "@/lib/runtime";

export type SendingQuotaDomainStatus = {
	hostname: string;
	sendingProvider: "none" | "cloudflare" | "resend" | "ses";
	receivingProvider: "none" | "cloudflare" | "resend" | "ses";
	/** Live Cloudflare Email Routing state, read from the Cloudflare API for domains that send through Cloudflare. */
	cloudflareEmailRouting: { enabled: boolean; status: string | null; error: string | null } | null;
};

export type SendingQuotaReport = {
	/** Outbound messages the provider accepted since 00:00 UTC today, counted from outbound_jobs. */
	sentToday: number;
	/** Outbound messages that failed since 00:00 UTC today. */
	failedToday: number;
	/** Jobs currently waiting to be delivered (undo-send window and scheduled sends). */
	queuedNow: number;
	cloudflareConfigured: boolean;
	domains: SendingQuotaDomainStatus[];
};

function startOfUtcDay(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function readCloudflareEmailRouting(env: CloudflareEnv, hostname: string): Promise<SendingQuotaDomainStatus["cloudflareEmailRouting"]> {
	try {
		const zone = await findZoneByHostname(env, hostname);
		if (!zone) return null;
		const settings = await getEmailRoutingSettings(env, zone.id);
		return { enabled: settings.enabled === true, status: settings.status ?? null, error: null };
	} catch (error) {
		// A per-zone lookup failure must not break the whole report.
		return { enabled: false, status: null, error: error instanceof Error ? error.message : "lookup failed" };
	}
}

/**
 * Sending quota for the admin overview. Cloudflare does not expose a
 * remaining-quota endpoint for email sending, so the "used" side comes from this
 * installation's outbound_jobs and the "provider" side is read live from the
 * Cloudflare API (Email Routing state for every domain that sends through it).
 */
export async function getSendingQuota(env: CloudflareEnv): Promise<SendingQuotaReport> {
	const db = getDb(env);
	const dayStart = startOfUtcDay();
	const [sentRow] = await db
		.select({ total: count() })
		.from(outboundJobs)
		.where(and(eq(outboundJobs.status, "sent"), gte(outboundJobs.updatedAt, dayStart)));
	const [failedRow] = await db
		.select({ total: count() })
		.from(outboundJobs)
		.where(and(eq(outboundJobs.status, "failed"), gte(outboundJobs.updatedAt, dayStart)));
	const [queuedRow] = await db
		.select({ total: count() })
		.from(outboundJobs)
		.where(eq(outboundJobs.status, "queued"));

	const configured = hasCloudflareCredentials(env);
	const rows = await db
		.select({ hostname: domains.hostname, sendingProvider: domains.sendingProvider, receivingProvider: domains.receivingProvider })
		.from(domains);
	const active = rows.filter((row) => row.sendingProvider !== "none");
	const domainStatuses: SendingQuotaDomainStatus[] = [];
	for (const row of active) {
		const lookup = configured && row.sendingProvider === "cloudflare" ? await readCloudflareEmailRouting(env, row.hostname) : null;
		domainStatuses.push({
			hostname: row.hostname,
			sendingProvider: row.sendingProvider,
			receivingProvider: row.receivingProvider,
			cloudflareEmailRouting: lookup,
		});
	}
	return {
		sentToday: sentRow?.total ?? 0,
		failedToday: failedRow?.total ?? 0,
		queuedNow: queuedRow?.total ?? 0,
		cloudflareConfigured: configured,
		domains: domainStatuses,
	};
}
