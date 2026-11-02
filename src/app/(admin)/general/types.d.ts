export interface GeneralSettings {
	outboundAttachmentMaxMb: number;
	/** Per-user Drive cap in GB; null when unlimited. */
	driveStorageLimitGb: number | null;
}

export interface SendingQuotaDomainStatus {
	hostname: string;
	sendingProvider: "none" | "cloudflare" | "resend" | "ses";
	receivingProvider: "none" | "cloudflare" | "resend" | "ses";
	cloudflareEmailRouting: { enabled: boolean; status: string | null; error: string | null } | null;
}

export interface SendingQuotaReport {
	sentToday: number;
	failedToday: number;
	queuedNow: number;
	cloudflareConfigured: boolean;
	domains: SendingQuotaDomainStatus[];
}
