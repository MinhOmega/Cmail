import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Cmail",
		short_name: "Cmail",
		description: "Email, anywhere.",
		id: "/",
		scope: "/",
		start_url: "/inbox",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#ffffff",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			// Reused for maskable contexts (Android splash, adaptive launcher icons).
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
