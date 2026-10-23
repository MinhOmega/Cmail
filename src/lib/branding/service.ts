import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import type { Branding } from "./types";
import { getLicenseEntitlements } from "@/lib/licenses/service";

export const APP_SETTINGS_ID = "default";
export const DEFAULT_APP_NAME = "Cmail";
export const BRANDING_ICON_KEY = "branding/app-icon";

export async function getBranding(env: CloudflareEnv): Promise<Branding> {
	const entitlements = await getLicenseEntitlements(env);
	if (!entitlements.canCustomizeBranding) {
		return { appName: DEFAULT_APP_NAME, hasCustomIcon: false, accentColor: null, canCustomizeBranding: false };
	}

	try {
		const [settings] = await getDb(env)
			.select()
			.from(appSettings)
			.where(eq(appSettings.id, APP_SETTINGS_ID))
			.limit(1);
		return {
			appName: settings?.appName || DEFAULT_APP_NAME,
			hasCustomIcon: !!settings?.iconKey,
			accentColor: settings?.accentColor ?? null,
			canCustomizeBranding: true,
		};
	} catch {
		return { appName: DEFAULT_APP_NAME, hasCustomIcon: false, accentColor: null, canCustomizeBranding: true };
	}
}

export async function updateBranding(
	env: CloudflareEnv,
	input: { appName: string; icon?: File | null; accentColor?: string | null },
): Promise<Branding> {
	if (!(await getLicenseEntitlements(env)).canCustomizeBranding) {
		throw new Error("A Pro or Team license is required to customize branding");
	}
	let iconKey: string | undefined;
	if (input.icon) {
		iconKey = BRANDING_ICON_KEY;
		await env.BUCKET.put(iconKey, await input.icon.arrayBuffer(), {
			httpMetadata: { contentType: input.icon.type },
		});
	}

	await getDb(env)
		.insert(appSettings)
		.values({
			id: APP_SETTINGS_ID,
			appName: input.appName,
			accentColor: input.accentColor ?? null,
			iconKey: iconKey ?? null,
		})
		.onConflictDoUpdate({
			target: appSettings.id,
			set: {
				appName: input.appName,
				accentColor: input.accentColor ?? null,
				...(iconKey ? { iconKey } : {}),
				updatedAt: new Date(),
			},
		});
	return getBranding(env);
}
