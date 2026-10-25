import type { AppDatabase } from "@/db";
import { getEnv } from "@/lib/cloudflare";
import { getLicenseEntitlements } from "@/lib/licenses/service";

export async function isTeamMailboxSharingEnabled(_db: AppDatabase): Promise<boolean> {
	try {
		return (await getLicenseEntitlements(getEnv())).canShareMailboxes;
	} catch {
		return false;
	}
}
