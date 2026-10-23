import type { LicenseEntitlements } from "./types";

function forkFeature(env: CloudflareEnv, flag: string): boolean {
	// Fork-local capability flags set via deployment vars (ENABLE_*).
	return (env as unknown as Record<string, string | undefined>)[flag] === "true";
}

export async function getLicenseEntitlements(env: CloudflareEnv): Promise<LicenseEntitlements> {
	// Fork entitlements: this AGPL fork implements these capabilities itself and
	// gates them with ENABLE_* deployment vars. Upstream's commercial licensing
	// (Paymug activation) was removed from this fork.
	return {
		plan: "community",
		canCustomizeBranding: forkFeature(env, "ENABLE_BRANDING"),
		canManageAccounts: forkFeature(env, "ENABLE_MULTIUSER"),
		canShareMailboxes: forkFeature(env, "ENABLE_SHARED_MAILBOXES"),
		accountSeatLimit: null,
		canForwardEmail: forkFeature(env, "ENABLE_FORWARDING"),
	};
}
