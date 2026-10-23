"use client";

import { useEffect } from "react";
import { registerCmailServiceWorker } from "@/lib/push/client";

export function PwaServiceWorker() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		void registerCmailServiceWorker().catch((error) => {
			console.warn("Cmail service worker registration failed", error);
		});
	}, []);

	return null;
}
