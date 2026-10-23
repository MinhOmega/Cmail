"use client";

export const USER_TIME_ZONE_CHANGED_EVENT = "cmail:user-time-zone-changed";

export function saveUserTimeZonePreference(userId: string, timeZone: string | null): void {
	const next = JSON.stringify({ userId, timeZone });
	try {
		if (localStorage.getItem("cmail-user-time-zone") === next) return;
		localStorage.setItem("cmail-user-time-zone", next);
	} catch { /* Saving on the server remains authoritative. */ }
	window.dispatchEvent(new Event(USER_TIME_ZONE_CHANGED_EVENT));
}

export function clearUserTimeZonePreference(): void {
	try { localStorage.removeItem("cmail-user-time-zone"); }
	catch { /* Storage is optional. */ }
}
