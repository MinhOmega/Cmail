"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { loadGeneralSettings, loadSendingQuota, saveGeneralSettings } from "./utils";
import type { SendingQuotaReport } from "./types";

export default function GeneralSettingsPage() {
	const { t } = useLanguage();
	const [maxMb, setMaxMb] = useState(25);
	const [loaded, setLoaded] = useState(false);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState("");
	const [unlimited, setUnlimited] = useState(true);
	const [limitGb, setLimitGb] = useState(10);
	const [driveSaving, setDriveSaving] = useState(false);
	const [driveStatus, setDriveStatus] = useState("");
	const [quota, setQuota] = useState<SendingQuotaReport | null>(null);
	const [quotaError, setQuotaError] = useState("");

	useEffect(() => {
		let active = true;
		void loadGeneralSettings().then((settings) => {
			if (active) { setMaxMb(settings.outboundAttachmentMaxMb); setUnlimited(settings.driveStorageLimitGb === null); if (settings.driveStorageLimitGb !== null) setLimitGb(settings.driveStorageLimitGb); setLoaded(true); }
		}).catch((error) => { if (active) setStatus(error instanceof Error ? error.message : t("general.loadFailed")); });
		void loadSendingQuota().then((report) => {
			if (active) setQuota(report);
		}).catch((error) => { if (active) setQuotaError(error instanceof Error ? error.message : t("general.loadFailed")); });
		return () => { active = false; };
	}, [t]);

	async function save(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setStatus("");
		try {
			const settings = await saveGeneralSettings({ outboundAttachmentMaxMb: maxMb });
			setMaxMb(settings.outboundAttachmentMaxMb);
			setStatus(t("general.saved"));
		} catch (error) {
			setStatus(error instanceof Error ? error.message : t("general.saveFailed"));
		} finally { setSaving(false); }
	}

	async function saveDrive(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setDriveSaving(true);
		setDriveStatus("");
		try {
			const settings = await saveGeneralSettings({ driveStorageLimitGb: unlimited ? null : limitGb });
			setUnlimited(settings.driveStorageLimitGb === null);
			if (settings.driveStorageLimitGb !== null) setLimitGb(settings.driveStorageLimitGb);
			setDriveStatus(t("general.driveSaved"));
		} catch (error) {
			setDriveStatus(error instanceof Error ? error.message : t("general.saveFailed"));
		} finally { setDriveSaving(false); }
	}

	return <div className="space-y-6">
		<div><h1 className="text-2xl md:text-3xl font-medium text-neutral-900">{t("general.title")}</h1><p className="mt-2 text-sm text-neutral-500">{t("general.description")}</p></div>
		<Card className="rounded-3xl border-0 bg-white p-6">
			<CardHeader className="py-0"><CardTitle>{t("general.attachments")}</CardTitle></CardHeader>
			<CardContent className="pt-6"><form onSubmit={save} className="space-y-4">
				<div className="space-y-2"><Label htmlFor="attachment-limit">{t("general.maxAttachments")}</Label><Input id="attachment-limit" type="number" min="1" max="25" step="1" value={maxMb} onChange={(event) => setMaxMb(Number(event.target.value))} disabled={!loaded || saving} className="max-w-40" required /><p className="text-sm text-neutral-500">{t("general.appliesTo")}</p></div>
				<div className="space-y-2 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700"><p>{t("general.cloudflareLimit")}</p><p>{t("general.largeFiles")}</p></div>
				{status && <p role="status" className="text-sm text-neutral-700">{status}</p>}
				<Button type="submit" disabled={!loaded || saving || !Number.isInteger(maxMb) || maxMb < 1 || maxMb > 25}>{saving ? t("common.saving") : t("general.save")}</Button>
			</form></CardContent>
		</Card>
		<Card className="rounded-3xl border-0 bg-white p-6">
			<CardHeader className="py-0"><CardTitle>{t("general.drive")}</CardTitle></CardHeader>
			<CardContent className="pt-6"><form onSubmit={saveDrive} className="space-y-4">
				<div className="flex items-center gap-3"><Switch id="drive-unlimited" checked={unlimited} onCheckedChange={setUnlimited} disabled={!loaded || driveSaving} /><Label htmlFor="drive-unlimited">{t("general.driveUnlimited")}</Label></div>
				{!unlimited && <div className="space-y-2"><Label htmlFor="drive-limit">{t("general.driveLimit")}</Label><Input id="drive-limit" type="number" min="0.01" max="1000000" step="any" value={limitGb} onChange={(event) => setLimitGb(Number(event.target.value))} disabled={!loaded || driveSaving} className="max-w-40" required /></div>}
				<p className="text-sm text-neutral-500">{t("general.driveHint")}</p>
				{driveStatus && <p role="status" className="text-sm text-neutral-700">{driveStatus}</p>}
				<Button type="submit" disabled={!loaded || driveSaving || (!unlimited && !(limitGb > 0))}>{driveSaving ? t("common.saving") : t("general.save")}</Button>
			</form></CardContent>
		</Card>
		<Card className="rounded-3xl border-0 bg-white p-6">
			<CardHeader className="py-0"><CardTitle>{t("general.sendingQuota")}</CardTitle></CardHeader>
			<CardContent className="space-y-4 pt-6">
				{quotaError && <p role="alert" className="text-sm text-red-600">{quotaError}</p>}
				{!quotaError && quota && (
					<>
						<div className="grid grid-cols-3 gap-3">
							<div className="rounded-xl bg-neutral-50 p-4"><p className="text-2xl font-semibold text-neutral-900">{quota.sentToday}</p><p className="mt-1 text-sm text-neutral-500">{t("general.sentToday")}</p></div>
							<div className="rounded-xl bg-neutral-50 p-4"><p className={`text-2xl font-semibold ${quota.failedToday > 0 ? "text-red-600" : "text-neutral-900"}`}>{quota.failedToday}</p><p className="mt-1 text-sm text-neutral-500">{t("general.failedToday")}</p></div>
							<div className="rounded-xl bg-neutral-50 p-4"><p className="text-2xl font-semibold text-neutral-900">{quota.queuedNow}</p><p className="mt-1 text-sm text-neutral-500">{t("general.queuedNow")}</p></div>
						</div>
						{quota.domains.length === 0 ? (
							<p className="text-sm text-neutral-500">{t("general.noSendingDomains")}</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead><tr className="border-b border-neutral-100 text-neutral-500">
										<th className="py-2 pr-4 font-medium">{t("general.domainColumn")}</th>
										<th className="py-2 pr-4 font-medium">{t("general.providerColumn")}</th>
										<th className="py-2 font-medium">{t("general.cfRoutingColumn")}</th>
									</tr></thead>
									<tbody>
										{quota.domains.map((domain) => (
											<tr key={domain.hostname} className="border-b border-neutral-50 last:border-0">
												<td className="py-2 pr-4 font-medium text-neutral-900">{domain.hostname}</td>
												<td className="py-2 pr-4 text-neutral-700">{domain.sendingProvider}</td>
												<td className="py-2 text-neutral-700">
													{domain.sendingProvider !== "cloudflare" || !domain.cloudflareEmailRouting ? <span className="text-neutral-400">—</span>
														: domain.cloudflareEmailRouting.error ? <span className="text-red-600">{domain.cloudflareEmailRouting.error}</span>
														: domain.cloudflareEmailRouting.enabled ? <span className="text-emerald-700">{t("general.routingEnabled")}{domain.cloudflareEmailRouting.status ? ` (${domain.cloudflareEmailRouting.status})` : ""}</span>
														: <span className="text-amber-700">{t("general.routingDisabled")}</span>}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						{!quota.cloudflareConfigured && <p className="text-sm text-amber-700">{t("general.cfNotConfigured")}</p>}
						<p className="text-sm text-neutral-500">{t("general.quotaNote")}</p>
					</>
				)}
			</CardContent>
		</Card>
	</div>;
}
