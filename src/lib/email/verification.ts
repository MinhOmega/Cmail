import { DEFAULT_CLOUDFLARE_MODEL } from "@/lib/agent/provider-constants";

/**
 * Extracts one-time verification codes from inbound mail (fork feature).
 * A cheap regex pass runs first; Workers AI is only consulted when the mail
 * looks like a verification message but the regex cannot find a code.
 */
const CODE_HINT = /\b(code|otp|passcode|pin|token|verification|verify|verify your|confirm|authenticate|security|login|xác minh|mã xác nhận|kích hoạt)\b/i;
const CODE_BODY_PATTERNS: RegExp[] = [
	/\b([0-9]{6})\b/,
	/\b([0-9]{4,8})\b/,
	/\b([A-Z][A-Z0-9]{4,7})\b/,
];

export function extractVerificationCode(subject: string | null, text: string | null): string | null {
	if (!text && !subject) return null;
	const haystack = `${subject ?? ""}\n${text ?? ""}`;
	if (!CODE_HINT.test(haystack)) return null;
	for (const pattern of CODE_BODY_PATTERNS) {
		const match = text?.match(pattern);
		if (match?.[1]) return match[1];
	}
	return null;
}

export async function extractVerificationCodeWithAI(
	env: CloudflareEnv,
	subject: string | null,
	text: string | null,
): Promise<string | null> {
	const regexCode = extractVerificationCode(subject, text);
	if (regexCode) return regexCode;
	const haystack = `${subject ?? ""}\n${text ?? ""}`;
	if (!CODE_HINT.test(haystack)) return null;
	if (!env.AI || !text) return null;
	try {
		const prompt =
			"You extract one-time verification codes from emails. " +
			"Reply with ONLY the code (4-10 letters or digits) and nothing else. " +
			"If the email does not contain a verification code, reply with exactly NONE.\n\n" +
			`Subject: ${subject ?? "(none)"}\n\nEmail body:\n${text.slice(0, 4000)}`;
		const result = await env.AI.run(DEFAULT_CLOUDFLARE_MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 200 });
		const raw = Array.isArray(result) ? result.join("") : String((result as { response?: string })?.response ?? result ?? "");
		const reply = raw.trim().replace(/^["'`\s]+|["'`\s]+$/g, "");
		if (!reply || reply.toUpperCase().includes("NONE")) return null;
		const candidate = reply.match(/[A-Za-z0-9]{4,10}/)?.[0];
		return candidate ?? null;
	} catch {
		return null;
	}
}
