"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { browserSupportsPush, enablePushNotifications, getPushState } from "@/lib/push/client";

const DISMISSAL_KEY = "cmail:push-prompt-dismissed";

/**
 * One-tap enablement for Web Push, aimed at the phone experience: an installed
 * PWA (or a narrow viewport) that could receive mail alerts but has not been
 * asked yet. The request must come from a user gesture, so the banner's button
 * is what triggers the browser permission dialog. Everything else — the
 * Settings → Inbox toggle, resubscribing an existing subscription — is handled
 * by the push client and the settings card.
 */
export function PwaPushPrompt() {
	const { t } = useLanguage();
	const [visible, setVisible] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		if (!browserSupportsPush()) return;
		if (localStorage.getItem(DISMISSAL_KEY)) return;
		// Only prompt where the prompt makes sense: an installed PWA or a phone-sized screen.
		const standalone = window.matchMedia("(display-mode: standalone)").matches;
		const phone = window.matchMedia("(max-width: 640px)").matches;
		if (!standalone && !phone) return;
		void getPushState()
			.then((state) => {
				// getPushState loads the config with credentials; on the login page it
				// fails and we stay hidden. Denied permission means the browser blocked
				// us and no banner will change that.
				if (!cancelled && state.configured && !state.subscribed && state.permission !== "denied") setVisible(true);
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	if (!visible) return null;

	function dismiss() {
		localStorage.setItem(DISMISSAL_KEY, "1");
		setVisible(false);
	}

	function enable() {
		setBusy(true);
		void enablePushNotifications()
			.then(() => setVisible(false))
			.catch(() => {
				// The permission dialog was dismissed or subscribe failed; the Settings
				// → Inbox toggle remains for another try.
				dismiss();
			})
			.finally(() => setBusy(false));
	}

	return (
		<div role="dialog" aria-label={t("pwa.pushPromptTitle")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg shadow-neutral-900/10">
			<div className="flex items-start gap-3">
				<div className="flex-1">
					<p className="text-sm font-medium text-neutral-900">{t("pwa.pushPromptTitle")}</p>
					<p className="mt-1 text-sm text-neutral-500">{t("pwa.pushPromptBody")}</p>
				</div>
			</div>
			<div className="mt-3 flex justify-end gap-2">
				<Button variant="ghost" size="sm" onClick={dismiss}>{t("pwa.pushPromptDismiss")}</Button>
				<Button size="sm" onClick={enable} disabled={busy}>{busy ? "..." : t("pwa.pushPromptEnable")}</Button>
			</div>
		</div>
	);
}
