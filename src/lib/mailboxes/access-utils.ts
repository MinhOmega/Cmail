import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { licenseSettings } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { getLicenseEntitlements } from "@/lib/licenses/service";

/**
 * Fork: sharing is enabled by the ENABLE_SHARED_MAILBOXES flag, or by a legacy
 * active team license row so upstream fixtures and self-hosters keep working.
 */
export async function isTeamMailboxSharingEnabled(db: AppDatabase): Promise<boolean> {
	try {
		if ((await getLicenseEntitlements(getEnv())).canShareMailboxes) return true;
	} catch {
		// no runnable env here; fall through to the license row
	}
	try {
		const [license] = await db
			.select({ plan: licenseSettings.plan, state: licenseSettings.state })
			.from(licenseSettings)
			.where(eq(licenseSettings.id, "default"))
			.limit(1);
		return license?.plan === "team" && license.state === "active";
	} catch {
		return false;
	}
}
