/**
 * What the sign-in QR code encodes. The Cmail mobile app scans it to fill in
 * its sign-in form: `cmail://signin?server=…&email=…&key=…`.
 */
export function buildSignInQrPayload({ server, email, key }: { server: string; email: string; key: string }): string {
	const params = new URLSearchParams({ server });
	if (email) params.set("email", email);
	params.set("key", key);
	return `cmail://signin?${params.toString()}`;
}
