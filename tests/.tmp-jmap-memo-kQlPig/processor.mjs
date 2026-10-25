import {
  appSettings,
  auditLogs,
  contacts,
  domainTrackingHosts,
  domains,
  folders,
  followUps,
  getDb,
  jmapChangeFloor,
  jmapChanges,
  licenseSettings,
  mailboxAccess,
  mailboxAliases,
  mailboxes,
  messageAttachments,
  messageTracking,
  messages,
  openExternalDatabase,
  outboundJobs,
  resolveDatabaseConfig,
  schemaDialect,
  sharedAttachmentLinks,
  userComposePreferences,
  users,
  webhookDeliveries,
  webhooks
} from "./chunk-GYQK7DBU.mjs";
import "./chunk-UV2HVMKZ.mjs";

// src/lib/jmap/constants.ts
var CAPABILITY_CORE = "urn:ietf:params:jmap:core";
var CAPABILITY_MAIL = "urn:ietf:params:jmap:mail";
var CAPABILITY_SUBMISSION = "urn:ietf:params:jmap:submission";
var LIMITS = {
  maxSizeUpload: 10 * 1024 * 1024,
  maxSizeRequest: 10 * 1024 * 1024,
  maxCallsInRequest: 32,
  maxObjectsInGet: 200,
  maxObjectsInSet: 100,
  maxSizeAttachmentsPerEmail: 20 * 1024 * 1024,
  /** Email/query never returns more than this many ids per call. */
  maxQueryLimit: 250
};
var KEYWORD_SEEN = "$seen";
var KEYWORD_FLAGGED = "$flagged";
var KEYWORD_DRAFT = "$draft";

// src/lib/jmap/errors.ts
var JmapError = class extends Error {
  constructor(type, description, extra = {}) {
    super(description ?? type);
    this.type = type;
    this.extra = extra;
  }
  type;
  extra;
  toMethodError() {
    return { type: this.type, ...this.message !== this.type ? { description: this.message } : {}, ...this.extra };
  }
};
function invalidArguments(description) {
  return new JmapError("invalidArguments", description);
}
function unsupportedFilter(description) {
  return new JmapError("unsupportedFilter", description);
}

// src/lib/jmap/mailboxes.ts
import { and as and5, count, eq as eq6, inArray as inArray3, isNull, sql as sql3 } from "drizzle-orm";

// src/lib/jmap/changes.ts
import { and as and4, asc, eq as eq5, gt, inArray as inArray2, sql as sql2 } from "drizzle-orm";

// src/db/sql.ts
import { ilike, like, sql } from "drizzle-orm";
var dialect = schemaDialect();
function insensitiveLike(column, pattern) {
  return dialect === "postgres" ? ilike(column, pattern) : like(column, pattern);
}
function concatText(...parts) {
  const list = parts.map((part) => typeof part === "string" ? sql.raw(`'${part.replace(/'/g, "''")}'`) : part);
  return dialect === "mysql" ? sql`concat(${sql.join(list, sql`, `)})` : sql.join(list, sql` || `);
}
var matchNothing = sql`1 = 0`;
var matchEverything = sql`1 = 1`;

// src/lib/jmap/access.ts
import { and as and3, eq as eq4, inArray } from "drizzle-orm";

// src/lib/mailboxes/access.ts
import { and, eq as eq2 } from "drizzle-orm";

// src/lib/mailboxes/access-utils.ts
import { eq } from "drizzle-orm";

// src/lib/cloudflare.ts
import { env } from "cloudflare:workers";

// src/lib/runtime.ts
function getNodeEnv() {
  return globalThis.__cmailNodeEnv;
}

// src/db/with-database.ts
var wrapped = /* @__PURE__ */ new WeakMap();
var proxies = /* @__PURE__ */ new WeakSet();
var opened = /* @__PURE__ */ new Map();
function getDatabaseConfig(env2) {
  const processEnv = globalThis.process?.env ?? {};
  const pick2 = (key) => typeof env2[key] === "string" && env2[key].trim() ? env2[key] : processEnv[key];
  return resolveDatabaseConfig(
    { DATABASE_URL: pick2("DATABASE_URL"), DATABASE_DRIVER: pick2("DATABASE_DRIVER"), DATABASE_AUTH_TOKEN: pick2("DATABASE_AUTH_TOKEN") },
    env2.HYPERDRIVE?.connectionString
  );
}
function withDatabase(env2) {
  if (proxies.has(env2)) return env2;
  const cached = wrapped.get(env2);
  if (cached) return cached;
  const config = getDatabaseConfig(env2);
  if (config.driver === "d1") return env2;
  const key = `${config.driver}|${config.url}`;
  let database = opened.get(key);
  if (!database) {
    database = openExternalDatabase(config, env2.CMAIL_RUNTIME === "node");
    opened.set(key, database);
  }
  const proxy = new Proxy(env2, { get: (target, property) => property === "DB" ? database : Reflect.get(target, property) });
  wrapped.set(env2, proxy);
  proxies.add(proxy);
  return proxy;
}

// src/lib/storage/b2-config.ts
var ENDPOINT_PATTERN = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/;
function normalizeB2Endpoint(value) {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}
function b2RegionFromEndpoint(endpoint) {
  return ENDPOINT_PATTERN.exec(endpoint)?.[1] ?? null;
}
function getB2Config(env2) {
  const keyId = env2.B2_KEY_ID?.trim();
  const applicationKey = env2.B2_APPLICATION_KEY?.trim();
  const bucket = env2.B2_BUCKET?.trim();
  const endpoint = env2.B2_ENDPOINT ? normalizeB2Endpoint(env2.B2_ENDPOINT) : "";
  if (!keyId || !applicationKey || !bucket || !endpoint) return null;
  const region = b2RegionFromEndpoint(endpoint);
  if (!region) return null;
  return { keyId, applicationKey, bucket, endpoint, region };
}
var S3_REGION_PATTERN = /^[a-z]{2}(-gov|-iso[a-z]?)?-[a-z]+-\d$/;
function getS3Config(env2) {
  const bucket = env2.S3_BUCKET?.trim();
  const region = (env2.S3_REGION ?? env2.AWS_REGION ?? env2.AWS_DEFAULT_REGION)?.trim();
  const keyId = (env2.S3_ACCESS_KEY_ID ?? env2.AWS_ACCESS_KEY_ID)?.trim();
  const applicationKey = (env2.S3_SECRET_ACCESS_KEY ?? env2.AWS_SECRET_ACCESS_KEY)?.trim();
  if (!bucket || !region || !keyId || !applicationKey || !S3_REGION_PATTERN.test(region)) return null;
  return { keyId, applicationKey, bucket, region, endpoint: `s3.${region}.amazonaws.com` };
}
function getObjectStorageConfig(env2) {
  const b2 = getB2Config(env2);
  if (b2) return { ...b2, provider: "backblaze" };
  const s3 = getS3Config(env2);
  return s3 ? { ...s3, provider: "s3" } : null;
}

// src/lib/aws/sigv4.ts
var encoder = new TextEncoder();
function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(data) {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  return hex(await crypto.subtle.digest("SHA-256", bytes));
}
async function hmac(key, data) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", imported, encoder.encode(data));
}
var rfc3986 = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
async function signAwsRequest(input) {
  const { method, url, region, service, credentials } = input;
  const amzDate = (input.now ?? /* @__PURE__ */ new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(input.body);
  const headers = { ...input.headers, host: url.host, "x-amz-date": amzDate };
  if (service === "s3") headers["x-amz-content-sha256"] = payloadHash;
  if (credentials.sessionToken) headers["x-amz-security-token"] = credentials.sessionToken;
  const normalized = Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const signedHeaders = normalized.map(([name]) => name).join(";");
  const canonicalHeaders = normalized.map(([name, value]) => `${name}:${value}
`).join("");
  const canonicalPath = service === "s3" ? url.pathname || "/" : (url.pathname || "/").split("/").map((segment) => rfc3986(decodeURIComponent(segment))).join("/");
  const canonicalQuery = [...url.searchParams.entries()].map(([name, value]) => [rfc3986(name), rfc3986(value)]).sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0).map(([name, value]) => `${name}=${value}`).join("&");
  const canonicalRequest = [method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope2 = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope2, await sha256Hex(canonicalRequest)].join("\n");
  const kDate = await hmac(encoder.encode(`AWS4${credentials.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));
  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope2}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

// src/lib/aws/xml.ts
var unescapeXml = (value) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function xmlTag(xml, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? unescapeXml(match[1].trim()) : null;
}

// src/lib/aws/client.ts
var AwsError = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  get accessDenied() {
    return /AccessDenied|UnauthorizedOperation|AuthorizationError|NotAuthorized|Forbidden/i.test(this.code) || this.status === 403;
  }
};
async function parseError(response) {
  const text = await response.text().catch(() => "");
  let code = response.headers.get("x-amzn-errortype")?.split(":")[0] ?? "";
  let message = "";
  try {
    const json = JSON.parse(text);
    code ||= json.__type?.split("#").pop() ?? "";
    message = json.message ?? json.Message ?? "";
  } catch {
    code ||= xmlTag(text, "Code") ?? "";
    message = xmlTag(text, "Message") ?? "";
  }
  return new AwsError(message || `AWS request failed (${response.status})`, response.status, code || `HTTP${response.status}`);
}
async function awsRequest(request) {
  const { config, service } = request;
  const region = request.region ?? config.region;
  const url = new URL(`https://${request.host ?? `${service}.${region}.amazonaws.com`}${request.path ?? "/"}`);
  for (const [name, value] of Object.entries(request.query ?? {})) url.searchParams.set(name, value);
  const body = request.body ?? "";
  const method = request.method ?? "GET";
  const headers = await signAwsRequest({ method, url, headers: request.headers ?? {}, body, region, service, credentials: config });
  const response = await fetch(url, { method, headers, body: method === "GET" || method === "HEAD" ? void 0 : body });
  if (!response.ok) throw await parseError(response);
  return response;
}
async function awsJson(request) {
  const response = await awsRequest({
    ...request,
    body: request.json === void 0 ? request.body : JSON.stringify(request.json),
    headers: { "Content-Type": "application/json", ...request.headers }
  });
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// src/lib/storage/b2-bucket.ts
var META_PREFIX = "x-amz-meta-";
var encodePath = (key) => `/${key.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/")}`;
var escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function toBuffer(value) {
  if (value === null) return new ArrayBuffer(0);
  if (typeof value === "string") return new TextEncoder().encode(value).buffer;
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  if (value instanceof Blob) return value.arrayBuffer();
  return new Response(value).arrayBuffer();
}
function readMetadata(headers) {
  const customMetadata = {};
  headers.forEach((value, name) => {
    if (name.startsWith(META_PREFIX)) customMetadata[name.slice(META_PREFIX.length)] = value;
  });
  return {
    httpMetadata: {
      contentType: headers.get("content-type") ?? void 0,
      contentDisposition: headers.get("content-disposition") ?? void 0,
      cacheControl: headers.get("cache-control") ?? void 0
    },
    customMetadata
  };
}
function objectSize(headers) {
  const total = /\/(\d+)$/.exec(headers.get("content-range") ?? "")?.[1];
  return Number(total ?? headers.get("content-length") ?? 0);
}
var B2Object = class {
  constructor(key, response, size) {
    this.key = key;
    this.response = response;
    const headers = response.headers;
    this.size = size ?? objectSize(headers);
    this.etag = (headers.get("etag") ?? "").replace(/"/g, "");
    this.uploaded = new Date(headers.get("last-modified") ?? Date.now());
    const meta = readMetadata(headers);
    this.httpMetadata = meta.httpMetadata;
    this.customMetadata = meta.customMetadata;
  }
  key;
  response;
  size;
  etag;
  uploaded;
  httpMetadata;
  customMetadata;
  get httpEtag() {
    return `"${this.etag}"`;
  }
  get version() {
    return this.etag;
  }
  get body() {
    return this.response.body ?? new Blob([]).stream();
  }
  get bodyUsed() {
    return this.response.bodyUsed;
  }
  arrayBuffer() {
    return this.response.arrayBuffer();
  }
  text() {
    return this.response.text();
  }
  json() {
    return this.response.json();
  }
  blob() {
    return this.response.blob();
  }
  writeHttpMetadata(headers) {
    if (this.httpMetadata.contentType) headers.set("Content-Type", this.httpMetadata.contentType);
    if (this.httpMetadata.contentDisposition) headers.set("Content-Disposition", this.httpMetadata.contentDisposition);
    if (this.httpMetadata.cacheControl) headers.set("Cache-Control", this.httpMetadata.cacheControl);
  }
};
var B2Bucket = class {
  constructor(config) {
    this.config = config;
    this.credentials = { accessKeyId: config.keyId, secretAccessKey: config.applicationKey, region: config.region };
    this.host = `${config.bucket}.${config.endpoint}`;
  }
  config;
  credentials;
  host;
  request(key, init = {}) {
    return awsRequest({ config: this.credentials, service: "s3", host: this.host, path: key === null ? "/" : encodePath(key), ...init });
  }
  metadataHeaders(options) {
    const headers = {};
    const meta = options?.httpMetadata;
    const http = meta instanceof Headers ? { contentType: meta.get("content-type") ?? void 0, contentDisposition: meta.get("content-disposition") ?? void 0, cacheControl: meta.get("cache-control") ?? void 0 } : meta ?? {};
    if (http.contentType) headers["Content-Type"] = http.contentType;
    if (http.contentDisposition) headers["Content-Disposition"] = http.contentDisposition;
    if (http.cacheControl) headers["Cache-Control"] = http.cacheControl;
    for (const [name, value] of Object.entries(options?.customMetadata ?? {})) headers[`${META_PREFIX}${name.toLowerCase()}`] = value;
    return headers;
  }
  async get(key, options) {
    const range = options?.range;
    const headers = {};
    if (range) {
      if (range.suffix != null) headers.Range = `bytes=-${range.suffix}`;
      else {
        const start = range.offset ?? 0;
        headers.Range = range.length != null ? `bytes=${start}-${start + range.length - 1}` : `bytes=${start}-`;
      }
    }
    try {
      return new B2Object(key, await this.request(key, { headers }));
    } catch (error) {
      if (error instanceof AwsError && (error.status === 404 || error.code === "NoSuchKey")) return null;
      throw error;
    }
  }
  async head(key) {
    try {
      return new B2Object(key, await this.request(key, { method: "HEAD" }));
    } catch (error) {
      if (error instanceof AwsError && error.status === 404) return null;
      throw error;
    }
  }
  async put(key, value, options) {
    const body = await toBuffer(value);
    const response = await this.request(key, { method: "PUT", body, headers: this.metadataHeaders(options) });
    return new B2Object(key, new Response(null, { headers: response.headers }), body.byteLength);
  }
  async delete(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (let index = 0; index < list.length; index += 10) {
      await Promise.all(list.slice(index, index + 10).map(async (key) => {
        try {
          await this.request(key, { method: "DELETE" });
        } catch (error) {
          if (!(error instanceof AwsError && error.status === 404)) throw error;
        }
      }));
    }
  }
  async list() {
    throw new Error("B2Bucket.list is not implemented");
  }
  async createMultipartUpload(key, options) {
    const response = await this.request(key, { method: "POST", query: { uploads: "" }, headers: this.metadataHeaders(options) });
    const uploadId = xmlTag(await response.text(), "UploadId");
    if (!uploadId) throw new Error("Backblaze did not return an upload id");
    return this.resumeMultipartUpload(key, uploadId);
  }
  resumeMultipartUpload(key, uploadId) {
    return {
      key,
      uploadId,
      uploadPart: async (partNumber, value) => {
        if (!Number.isInteger(partNumber) || partNumber < 1) throw new Error("Invalid part number");
        const response = await this.request(key, { method: "PUT", query: { partNumber: String(partNumber), uploadId }, body: await toBuffer(value) });
        return { partNumber, etag: (response.headers.get("etag") ?? "").replace(/"/g, "") };
      },
      abort: async () => {
        await this.request(key, { method: "DELETE", query: { uploadId } });
      },
      complete: async (parts) => {
        const body = `<CompleteMultipartUpload>${[...parts].sort((a, b) => a.partNumber - b.partNumber).map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>"${escapeXml(part.etag)}"</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
        const response = await this.request(key, { method: "POST", query: { uploadId }, body, headers: { "Content-Type": "application/xml" } });
        const text = await response.text();
        if (/<Error>/.test(text)) throw new Error(xmlTag(text, "Message") ?? "Multipart upload failed");
        const head = await this.head(key);
        if (!head) throw new Error("Uploaded object not found");
        return head;
      }
    };
  }
};
function openB2Bucket(config) {
  return new B2Bucket(config);
}

// src/lib/storage/index.ts
var wrapped2 = /* @__PURE__ */ new WeakMap();
var proxies2 = /* @__PURE__ */ new WeakSet();
function withStorage(env2) {
  if (proxies2.has(env2)) return env2;
  const cached = wrapped2.get(env2);
  if (cached) return cached;
  const config = getObjectStorageConfig(env2);
  if (!config) return env2;
  const bucket = openB2Bucket(config);
  const proxy = new Proxy(env2, { get: (target, property) => property === "BUCKET" ? bucket : Reflect.get(target, property) });
  wrapped2.set(env2, proxy);
  proxies2.add(proxy);
  return proxy;
}

// src/lib/cloudflare.ts
function getEnv() {
  return withDatabase(withStorage(getNodeEnv() ?? env));
}

// src/lib/licenses/service.ts
function forkFeature(env2, flag) {
  return env2[flag] === "true";
}
async function getLicenseEntitlements(env2) {
  return {
    plan: "community",
    canCustomizeBranding: forkFeature(env2, "ENABLE_BRANDING"),
    canManageAccounts: forkFeature(env2, "ENABLE_MULTIUSER"),
    canShareMailboxes: forkFeature(env2, "ENABLE_SHARED_MAILBOXES"),
    accountSeatLimit: null,
    canForwardEmail: forkFeature(env2, "ENABLE_FORWARDING")
  };
}

// src/lib/mailboxes/access-utils.ts
async function isTeamMailboxSharingEnabled(db) {
  try {
    if ((await getLicenseEntitlements(getEnv())).canShareMailboxes) return true;
  } catch {
  }
  try {
    const [license] = await db.select({ plan: licenseSettings.plan, state: licenseSettings.state }).from(licenseSettings).where(eq(licenseSettings.id, "default")).limit(1);
    return license?.plan === "team" && license.state === "active";
  } catch {
    return false;
  }
}

// src/lib/mailboxes/access.ts
var permissionRank = {
  read_only: 1,
  send_on_behalf: 2,
  send_as: 3,
  full_access: 4
};
function hasMailboxPermission(permission, required) {
  return permissionRank[permission] >= permissionRank[required];
}
async function getMailboxAccessLevel(db, user, mailboxId) {
  const [mailbox] = await db.select().from(mailboxes).where(eq2(mailboxes.id, mailboxId)).limit(1);
  if (!mailbox || mailbox.disabled) return null;
  const isOwner = mailbox.userId === user.id;
  if (isOwner) return buildAccess(mailbox, "full_access", true);
  if (mailbox.type !== "shared" || !await isTeamMailboxSharingEnabled(db)) return null;
  const [delegatedAccess] = await db.select({ permission: mailboxAccess.permission }).from(mailboxAccess).where(and(eq2(mailboxAccess.mailboxId, mailbox.id), eq2(mailboxAccess.userId, user.id))).limit(1);
  if (delegatedAccess) return buildAccess(mailbox, delegatedAccess.permission, false);
  return null;
}
async function listAccessibleMailboxes(db, user) {
  const ownedRows = await db.select({
    id: mailboxes.id,
    userId: mailboxes.userId,
    domainId: mailboxes.domainId,
    localPart: mailboxes.localPart,
    displayName: mailboxes.displayName,
    signature: mailboxes.signature,
    autoReplyEnabled: mailboxes.autoReplyEnabled,
    autoReplySubject: mailboxes.autoReplySubject,
    autoReplyBody: mailboxes.autoReplyBody,
    useAllDomains: mailboxes.useAllDomains,
    avatarKey: mailboxes.avatarKey,
    type: mailboxes.type,
    disabled: mailboxes.disabled,
    createdAt: mailboxes.createdAt,
    hostname: domains.hostname
  }).from(mailboxes).innerJoin(domains, eq2(mailboxes.domainId, domains.id)).where(and(eq2(mailboxes.userId, user.id), eq2(mailboxes.disabled, false)));
  const owned = ownedRows.map((row) => {
    const { avatarKey, ...mailbox } = row;
    return {
      ...mailbox,
      hasAvatar: !!avatarKey,
      permission: "full_access",
      isPrimary: `${row.localPart}@${row.hostname}` === user.email
    };
  });
  if (!await isTeamMailboxSharingEnabled(db)) return owned;
  const sharedRows = await db.select({
    id: mailboxes.id,
    userId: mailboxes.userId,
    domainId: mailboxes.domainId,
    localPart: mailboxes.localPart,
    displayName: mailboxes.displayName,
    signature: mailboxes.signature,
    autoReplyEnabled: mailboxes.autoReplyEnabled,
    autoReplySubject: mailboxes.autoReplySubject,
    autoReplyBody: mailboxes.autoReplyBody,
    useAllDomains: mailboxes.useAllDomains,
    avatarKey: mailboxes.avatarKey,
    type: mailboxes.type,
    disabled: mailboxes.disabled,
    createdAt: mailboxes.createdAt,
    hostname: domains.hostname,
    permission: mailboxAccess.permission
  }).from(mailboxAccess).innerJoin(mailboxes, eq2(mailboxAccess.mailboxId, mailboxes.id)).innerJoin(domains, eq2(mailboxes.domainId, domains.id)).where(
    and(
      eq2(mailboxAccess.userId, user.id),
      eq2(mailboxes.type, "shared"),
      eq2(mailboxes.disabled, false)
    )
  );
  const shared = sharedRows.map((row) => {
    const { avatarKey, ...mailbox } = row;
    return {
      ...mailbox,
      hasAvatar: !!avatarKey,
      isPrimary: false
    };
  });
  return [...owned, ...shared];
}
function buildAccess(mailbox, permission, isOwner) {
  return {
    mailbox,
    permission,
    isOwner,
    canRead: hasMailboxPermission(permission, "read_only"),
    canSendAs: hasMailboxPermission(permission, "send_as"),
    canSendOnBehalf: hasMailboxPermission(permission, "send_on_behalf"),
    canManage: hasMailboxPermission(permission, "full_access")
  };
}

// src/lib/mailboxes/domain-addresses.ts
import { and as and2, eq as eq3 } from "drizzle-orm";

// src/lib/email/recipient-address.ts
function normalizeRecipientLocalPart(localPart) {
  const [baseLocalPart] = localPart.split("+", 1);
  return baseLocalPart.replaceAll(".", "").toLowerCase();
}

// src/lib/mailboxes/domain-addresses.ts
async function getMailboxAliasAddresses(db, mailboxId) {
  const aliases = await db.select({ localPart: mailboxAliases.localPart, hostname: domains.hostname }).from(mailboxAliases).innerJoin(domains, eq3(mailboxAliases.domainId, domains.id)).where(eq3(mailboxAliases.mailboxId, mailboxId));
  return aliases.map((alias) => `${alias.localPart}@${alias.hostname}`.toLowerCase());
}
async function getMailboxDomainAddresses(db, mailbox) {
  const [primaryDomain] = await db.select({ hostname: domains.hostname, userId: domains.userId }).from(domains).where(eq3(domains.id, mailbox.domainId)).limit(1);
  if (!primaryDomain) return [];
  const primaryAddress = `${mailbox.localPart}@${primaryDomain.hostname}`.toLowerCase();
  const aliasAddresses = await getMailboxAliasAddresses(db, mailbox.id);
  if (!mailbox.useAllDomains) {
    return [.../* @__PURE__ */ new Set([primaryAddress, ...aliasAddresses])];
  }
  const availableDomains = await db.select({ id: domains.id, hostname: domains.hostname }).from(domains).where(and2(eq3(domains.userId, primaryDomain.userId), eq3(domains.status, "active")));
  const assignedMailboxes = await db.select({ id: mailboxes.id, domainId: mailboxes.domainId, localPart: mailboxes.localPart }).from(mailboxes);
  const assignedAliases = await db.select({
    mailboxId: mailboxAliases.mailboxId,
    domainId: mailboxAliases.domainId,
    localPart: mailboxAliases.localPart
  }).from(mailboxAliases);
  const normalizedLocalPart = normalizeRecipientLocalPart(mailbox.localPart);
  const assignedDomainIds = new Set(
    [
      ...assignedMailboxes.filter(
        (item) => item.id !== mailbox.id && normalizeRecipientLocalPart(item.localPart) === normalizedLocalPart
      ),
      ...assignedAliases.filter(
        (item) => item.mailboxId !== mailbox.id && normalizeRecipientLocalPart(item.localPart) === normalizedLocalPart
      )
    ].map((item) => item.domainId)
  );
  return [
    .../* @__PURE__ */ new Set([
      primaryAddress,
      ...availableDomains.filter((domain) => domain.id !== mailbox.domainId && !assignedDomainIds.has(domain.id)).map((domain) => `${mailbox.localPart}@${domain.hostname}`.toLowerCase()),
      ...aliasAddresses
    ])
  ];
}

// src/lib/jmap/access.ts
function listJmapMailboxes(ctx) {
  if (ctx.memo === null) return loadJmapMailboxes(ctx);
  const memo = ctx.memo ??= {};
  if (!memo.mailboxes) {
    const pending = loadJmapMailboxes(ctx);
    memo.mailboxes = pending;
    pending.catch(() => {
      if (memo.mailboxes === pending) memo.mailboxes = void 0;
    });
  }
  return memo.mailboxes;
}
async function loadJmapMailboxes(ctx) {
  const rows = await listAccessibleMailboxes(ctx.db, ctx.auth.user);
  return rows.filter((row) => !ctx.auth.mailboxIds || ctx.auth.mailboxIds.includes(row.id)).map((row) => ({
    id: row.id,
    userId: row.userId,
    localPart: row.localPart,
    hostname: row.hostname,
    displayName: row.displayName,
    permission: row.permission,
    type: row.type,
    isPrimary: row.isPrimary
  }));
}
async function listAccessibleMailboxIdSet(ctx) {
  return new Set((await listJmapMailboxes(ctx)).map((row) => row.id));
}
async function listFoldersByMailbox(ctx, mailboxIds) {
  const result = /* @__PURE__ */ new Map();
  if (mailboxIds.length === 0) return result;
  const rows = await ctx.db.select({ id: folders.id, mailboxId: folders.mailboxId, name: folders.name }).from(folders).where(inArray(folders.mailboxId, mailboxIds));
  for (const row of rows) {
    const list = result.get(row.mailboxId) ?? [];
    list.push({ id: row.id, name: row.name });
    result.set(row.mailboxId, list);
  }
  return result;
}
async function listSendableAddresses(ctx, mailbox) {
  const [row] = await ctx.db.select().from(mailboxes).where(and3(eq4(mailboxes.id, mailbox.id))).limit(1);
  if (!row) return [];
  return getMailboxDomainAddresses(ctx.db, row);
}

// src/lib/jmap/ids.ts
var SEP = "~";
var SYSTEM_ROLES = ["inbox", "sent", "drafts", "archive", "junk", "trash"];
function encodeMailboxRef(ref) {
  if (ref.kind === "account") return ref.mailboxId;
  if (ref.kind === "role") return `${ref.mailboxId}${SEP}${ref.role}`;
  return `${ref.mailboxId}${SEP}f${SEP}${ref.folderId}`;
}
function decodeMailboxRef(id) {
  const parts = id.split(SEP);
  if (parts.length === 1 && parts[0]) return { kind: "account", mailboxId: parts[0] };
  if (parts.length === 2 && SYSTEM_ROLES.includes(parts[1])) {
    return { kind: "role", mailboxId: parts[0], role: parts[1] };
  }
  if (parts.length === 3 && parts[1] === "f" && parts[2]) return { kind: "folder", mailboxId: parts[0], folderId: parts[2] };
  return null;
}
function attachmentBlobId(attachmentId) {
  return `att${SEP}${attachmentId}`;
}
function messageBlobId(messageId) {
  return `msg${SEP}${messageId}`;
}
function decodeBlobId(blobId) {
  const index = blobId.indexOf(SEP);
  if (index < 0) return null;
  const kind = blobId.slice(0, index);
  const id = blobId.slice(index + 1);
  if (!id || kind !== "att" && kind !== "msg" && kind !== "up") return null;
  return { kind, id };
}
function identityId(mailboxId, address) {
  return `${mailboxId}${SEP}${address.toLowerCase()}`;
}
function decodeIdentityId(id) {
  const index = id.indexOf(SEP);
  if (index < 0) return null;
  return { mailboxId: id.slice(0, index), address: id.slice(index + 1) };
}
function roleToStatus(role) {
  switch (role) {
    case "inbox":
      return "received";
    case "sent":
      return "sent";
    case "drafts":
      return "draft";
    case "archive":
      return "archived";
    case "junk":
      return "spam";
    case "trash":
      return "trash";
  }
}
function statusToRole(status) {
  switch (status) {
    case "received":
      return "inbox";
    case "sent":
    case "queued":
    case "failed":
      return "sent";
    case "draft":
      return "drafts";
    case "archived":
      return "archive";
    case "spam":
      return "junk";
    case "trash":
      return "trash";
    default:
      return null;
  }
}

// src/lib/jmap/changes-utils.ts
var PREFIX = "c1";
function formatState(seq, fingerprint) {
  return `${PREFIX}:${seq}:${fingerprint}`;
}
function parseState(value) {
  if (typeof value !== "string") return null;
  const [prefix, seq, fingerprint, ...rest] = value.split(":");
  if (prefix !== PREFIX || !fingerprint || rest.length) return null;
  const number = Number(seq);
  return Number.isSafeInteger(number) && number >= 0 ? { seq: number, fingerprint } : null;
}
function coalesceChanges(rows) {
  const created = /* @__PURE__ */ new Set();
  const updated = /* @__PURE__ */ new Set();
  const destroyed = /* @__PURE__ */ new Set();
  for (const { id, change } of rows) {
    if (change === "created") {
      if (destroyed.delete(id)) updated.add(id);
      else created.add(id);
    } else if (change === "updated") {
      if (!created.has(id)) updated.add(id);
    } else if (change === "destroyed") {
      if (created.delete(id)) continue;
      updated.delete(id);
      destroyed.add(id);
    }
  }
  return { created: [...created], updated: [...updated], destroyed: [...destroyed] };
}

// src/lib/jmap/changes.ts
async function accessFingerprint(mailboxes2) {
  const material = JSON.stringify(mailboxes2.map((m) => [m.id, m.permission]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function floorSeq(ctx) {
  const [row] = await ctx.db.select({ seq: jmapChangeFloor.seq }).from(jmapChangeFloor).where(eq5(jmapChangeFloor.id, 1)).limit(1);
  return row?.seq ?? 0;
}
async function latestSeq(ctx, mailboxIds) {
  let latest = 0;
  for (let offset = 0; offset < mailboxIds.length; offset += 50) {
    const chunk = mailboxIds.slice(offset, offset + 50);
    const parts = chunk.map((id) => sql2`SELECT (SELECT max(seq) FROM jmap_changes WHERE mailbox_id = ${id}) AS seq`);
    const rows = await ctx.db.all(sql2.join(parts, sql2` UNION ALL `));
    for (const row of rows) latest = Math.max(latest, row.seq ?? 0);
  }
  return latest;
}
function currentChangeScope(ctx) {
  if (ctx.memo === null) return loadChangeScope(ctx);
  const memo = ctx.memo ??= {};
  if (!memo.scope) {
    const pending = loadChangeScope(ctx);
    memo.scope = pending;
    pending.catch(() => {
      if (memo.scope === pending) memo.scope = void 0;
    });
  }
  return memo.scope;
}
async function loadChangeScope(ctx) {
  const mailboxes2 = await listJmapMailboxes(ctx);
  const [seq, fingerprint, floor] = await Promise.all([latestSeq(ctx, mailboxes2.map((m) => m.id)), accessFingerprint(mailboxes2), floorSeq(ctx)]);
  const effective = Math.max(seq, floor);
  return { mailboxes: mailboxes2, seq: effective, fingerprint, state: formatState(effective, fingerprint) };
}
async function rowsSince(ctx, sinceState, objectType, limit) {
  const since = parseState(sinceState);
  const scope2 = await currentChangeScope(ctx);
  if (!since || since.fingerprint !== scope2.fingerprint || since.seq > scope2.seq) return null;
  if (since.seq < await floorSeq(ctx)) return null;
  const ids = scope2.mailboxes.map((m) => m.id);
  if (ids.length === 0) return { scope: scope2, rows: [], hasMore: false };
  const conditions = [inArray2(jmapChanges.mailboxId, ids), gt(jmapChanges.seq, since.seq)];
  if (objectType) conditions.push(eq5(jmapChanges.objectType, objectType));
  const rows = await ctx.db.select({
    seq: jmapChanges.seq,
    mailboxId: jmapChanges.mailboxId,
    objectType: jmapChanges.objectType,
    objectId: jmapChanges.objectId,
    threadId: jmapChanges.threadId,
    change: jmapChanges.change
  }).from(jmapChanges).where(and4(...conditions)).orderBy(asc(jmapChanges.seq)).limit(limit + 1);
  const hasMore = rows.length > limit;
  return { scope: scope2, rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
}
function maxChangesOf(args) {
  const requested = typeof args.maxChanges === "number" && args.maxChanges > 0 ? Math.floor(args.maxChanges) : 500;
  return Math.min(requested, 5e3);
}
function cannot() {
  return { type: "cannotCalculateChanges", description: "The state is too old or access changed; fetch again." };
}
async function emailChangesSince(ctx, args) {
  const limit = maxChangesOf(args);
  const result = await rowsSince(ctx, args.sinceState, "email", limit);
  if (!result) return cannot();
  const { created, updated, destroyed } = coalesceChanges(result.rows.map((row) => ({ id: row.objectId, change: row.change })));
  const newState = result.hasMore ? formatState(result.rows[result.rows.length - 1].seq, result.scope.fingerprint) : result.scope.state;
  return { accountId: ctx.accountId, oldState: args.sinceState, newState, hasMoreChanges: result.hasMore, created, updated, destroyed };
}
async function threadChangesSince(ctx, args) {
  const limit = maxChangesOf(args);
  const result = await rowsSince(ctx, args.sinceState, "email", limit);
  if (!result) return cannot();
  const firstChange = /* @__PURE__ */ new Map();
  for (const row of result.rows) {
    const thread = row.threadId ?? row.objectId;
    if (!firstChange.has(thread)) firstChange.set(thread, row.change);
  }
  const threads = Array.from(firstChange.keys());
  const ids = result.scope.mailboxes.map((m) => m.id);
  const threadKey = sql2`coalesce(${messages.threadId}, ${messages.id})`;
  const alive = /* @__PURE__ */ new Set();
  for (let offset = 0; offset < threads.length; offset += 100) {
    const chunk = threads.slice(offset, offset + 100);
    const rows = await ctx.db.selectDistinct({ thread: threadKey }).from(messages).where(and4(inArray2(threadKey, chunk), inArray2(messages.mailboxId, ids)));
    for (const row of rows) alive.add(row.thread);
  }
  const created = [];
  const updated = [];
  const destroyed = [];
  for (const [thread, first] of firstChange) {
    if (!alive.has(thread)) destroyed.push(thread);
    else if (first === "created" && result.rows.every((row) => (row.threadId ?? row.objectId) !== thread || row.change === "created")) created.push(thread);
    else updated.push(thread);
  }
  const newState = result.hasMore ? formatState(result.rows[result.rows.length - 1].seq, result.scope.fingerprint) : result.scope.state;
  return { accountId: ctx.accountId, oldState: args.sinceState, newState, hasMoreChanges: result.hasMore, created, updated, destroyed };
}
async function mailboxChangesSince(ctx, args) {
  const limit = maxChangesOf(args) * 20;
  const result = await rowsSince(ctx, args.sinceState, null, limit);
  if (!result) return cannot();
  const touched = /* @__PURE__ */ new Set();
  const folderChanges = [];
  for (const row of result.rows) {
    touched.add(row.mailboxId);
    if (row.objectType === "mailbox" && row.objectId !== row.mailboxId) {
      folderChanges.push({ id: encodeMailboxRef({ kind: "folder", mailboxId: row.mailboxId, folderId: row.objectId }), change: row.change });
    }
  }
  const { created, updated, destroyed } = coalesceChanges(folderChanges);
  const reported = /* @__PURE__ */ new Set([...created, ...updated, ...destroyed]);
  const folders2 = await listFoldersByMailbox(ctx, [...touched]);
  for (const mailboxId of touched) {
    const all = [
      encodeMailboxRef({ kind: "account", mailboxId }),
      ...SYSTEM_ROLES.map((role) => encodeMailboxRef({ kind: "role", mailboxId, role })),
      ...(folders2.get(mailboxId) ?? []).map((folder) => encodeMailboxRef({ kind: "folder", mailboxId, folderId: folder.id }))
    ];
    for (const id of all) {
      if (!reported.has(id)) {
        updated.push(id);
        reported.add(id);
      }
    }
  }
  const newState = result.hasMore ? formatState(result.rows[result.rows.length - 1].seq, result.scope.fingerprint) : result.scope.state;
  return { accountId: ctx.accountId, oldState: args.sinceState, newState, hasMoreChanges: result.hasMore, updatedProperties: null, created, updated, destroyed };
}

// node_modules/nanoid/index.js
import { webcrypto as crypto2 } from "node:crypto";

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
function fillPool(bytes) {
  if (bytes < 0) throw new RangeError("Wrong ID size");
  try {
    if (!pool || pool.length < bytes) {
      pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
      crypto2.getRandomValues(pool);
      poolOffset = 0;
    } else if (poolOffset + bytes > pool.length) {
      crypto2.getRandomValues(pool);
      poolOffset = 0;
    }
  } catch (e) {
    pool = void 0;
    throw e;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}

// src/lib/ids.ts
function newId(prefix) {
  const id = nanoid();
  return prefix ? `${prefix}_${id}` : id;
}

// src/lib/jmap/state.ts
async function getEmailState(ctx) {
  return (await currentChangeScope(ctx)).state;
}
async function getMailboxState(ctx, emailState) {
  return emailState ?? getEmailState(ctx);
}

// src/lib/jmap/mailboxes.ts
var ROLE_NAMES = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  junk: "Spam",
  trash: "Trash"
};
var ROLE_ORDER = { inbox: 1, drafts: 2, sent: 3, archive: 4, junk: 5, trash: 6 };
async function loadCounts(ctx, mailboxIds) {
  const result = /* @__PURE__ */ new Map();
  if (mailboxIds.length === 0) return result;
  const rows = await ctx.db.select({
    mailboxId: messages.mailboxId,
    status: messages.status,
    folderId: messages.folderId,
    total: count(),
    unread: sql3`sum(case when not ${messages.read} and ${messages.direction} = 'inbound' then 1 else 0 end)`
  }).from(messages).where(inArray3(messages.mailboxId, mailboxIds)).groupBy(messages.mailboxId, messages.status, messages.folderId);
  const add = (key, row) => {
    const current = result.get(key) ?? { total: 0, unread: 0 };
    result.set(key, { total: current.total + row.total, unread: current.unread + Number(row.unread ?? 0) });
  };
  for (const row of rows) {
    if (!row.mailboxId) continue;
    add(encodeMailboxRef({ kind: "account", mailboxId: row.mailboxId }), row);
    if (row.folderId) {
      add(encodeMailboxRef({ kind: "folder", mailboxId: row.mailboxId, folderId: row.folderId }), row);
      continue;
    }
    const role = statusRole(row.status);
    if (role) add(encodeMailboxRef({ kind: "role", mailboxId: row.mailboxId, role }), row);
  }
  return result;
}
function statusRole(status) {
  for (const role of SYSTEM_ROLES) if (roleToStatus(role) === status) return role;
  if (status === "queued" || status === "failed") return "sent";
  return null;
}
function rights(mailbox, system) {
  const canWrite = mailbox.permission !== "read_only";
  const canSend = mailbox.permission === "send_as" || mailbox.permission === "send_on_behalf" || mailbox.permission === "full_access";
  return {
    mayReadItems: true,
    mayAddItems: canWrite,
    mayRemoveItems: canWrite,
    maySetSeen: canWrite,
    maySetKeywords: canWrite,
    mayCreateChild: mailbox.permission === "full_access",
    mayRename: !system && mailbox.permission === "full_access",
    mayDelete: !system && mailbox.permission === "full_access",
    maySubmit: canSend
  };
}
async function buildAllMailboxes(ctx) {
  const accessible = await listJmapMailboxes(ctx);
  const ids = accessible.map((row) => row.id);
  const [foldersByMailbox, counts] = await Promise.all([listFoldersByMailbox(ctx, ids), loadCounts(ctx, ids)]);
  const list = [];
  let sortBase = 0;
  for (const mailbox of accessible) {
    const address = `${mailbox.localPart}@${mailbox.hostname}`;
    const accountId = encodeMailboxRef({ kind: "account", mailboxId: mailbox.id });
    const accountCounts = counts.get(accountId) ?? { total: 0, unread: 0 };
    list.push({
      id: accountId,
      name: mailbox.displayName ? `${mailbox.displayName} <${address}>` : address,
      parentId: null,
      role: null,
      sortOrder: sortBase,
      totalEmails: accountCounts.total,
      unreadEmails: accountCounts.unread,
      totalThreads: accountCounts.total,
      unreadThreads: accountCounts.unread,
      myRights: rights(mailbox, true),
      isSubscribed: true
    });
    for (const role of SYSTEM_ROLES) {
      const id = encodeMailboxRef({ kind: "role", mailboxId: mailbox.id, role });
      const c = counts.get(id) ?? { total: 0, unread: 0 };
      list.push({
        id,
        name: ROLE_NAMES[role],
        parentId: accountId,
        role,
        sortOrder: sortBase + ROLE_ORDER[role],
        totalEmails: c.total,
        unreadEmails: role === "inbox" ? c.unread : 0,
        totalThreads: c.total,
        unreadThreads: role === "inbox" ? c.unread : 0,
        myRights: rights(mailbox, true),
        isSubscribed: true
      });
    }
    for (const folder of foldersByMailbox.get(mailbox.id) ?? []) {
      const id = encodeMailboxRef({ kind: "folder", mailboxId: mailbox.id, folderId: folder.id });
      const c = counts.get(id) ?? { total: 0, unread: 0 };
      list.push({
        id,
        name: folder.name,
        parentId: accountId,
        role: null,
        sortOrder: sortBase + 10,
        totalEmails: c.total,
        unreadEmails: c.unread,
        totalThreads: c.total,
        unreadThreads: c.unread,
        myRights: rights(mailbox, false),
        isSubscribed: true
      });
    }
    sortBase += 100;
  }
  return list;
}
var mailboxGet = async (ctx, args) => {
  const all = await buildAllMailboxes(ctx);
  const ids = args.ids;
  const properties = args.properties;
  const wanted = ids ? all.filter((item) => ids.includes(item.id)) : all;
  const found = new Set(wanted.map((item) => item.id));
  return {
    accountId: ctx.accountId,
    state: await getMailboxState(ctx),
    list: wanted.map((item) => pick(item, properties)),
    notFound: ids ? ids.filter((id) => !found.has(id)) : []
  };
};
var mailboxQuery = async (ctx, args) => {
  const all = await buildAllMailboxes(ctx);
  const filter = args.filter ?? {};
  let rows = all;
  if (filter.parentId !== void 0) rows = rows.filter((item) => item.parentId === filter.parentId);
  if (filter.name) rows = rows.filter((item) => String(item.name).toLowerCase().includes(filter.name.toLowerCase()));
  if (filter.role !== void 0) rows = rows.filter((item) => item.role === filter.role);
  if (filter.hasAnyRole !== void 0) rows = rows.filter((item) => item.role !== null === filter.hasAnyRole);
  rows = [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  const position = Math.max(Number(args.position ?? 0), 0);
  const limit = args.limit == null ? rows.length : Math.max(Number(args.limit), 0);
  return {
    accountId: ctx.accountId,
    queryState: await getMailboxState(ctx),
    canCalculateChanges: false,
    position,
    ids: rows.slice(position, position + limit).map((item) => item.id),
    total: rows.length
  };
};
var mailboxChanges = async (ctx, args) => mailboxChangesSince(ctx, args);
var mailboxSet = async (ctx, args) => {
  const oldState = await getMailboxState(ctx);
  if (args.ifInState && args.ifInState !== oldState) return { type: "stateMismatch" };
  const accessible = await listJmapMailboxes(ctx);
  const created = {};
  const notCreated = {};
  const updated = {};
  const notUpdated = {};
  const destroyed = [];
  const notDestroyed = {};
  for (const [creationId, value] of Object.entries(args.create ?? {})) {
    const parent = typeof value.parentId === "string" ? decodeMailboxRef(value.parentId) : null;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const mailbox = parent && accessible.find((row) => row.id === parent.mailboxId);
    if (!parent || parent.kind !== "account" || !mailbox || mailbox.permission !== "full_access") {
      notCreated[creationId] = { type: "invalidProperties", properties: ["parentId"], description: "Folders live directly under a mailbox" };
      continue;
    }
    if (!name || name.length > 80) {
      notCreated[creationId] = { type: "invalidProperties", properties: ["name"] };
      continue;
    }
    const id = newId("fld");
    try {
      await ctx.db.insert(folders).values({ id, userId: mailbox.userId, mailboxId: mailbox.id, name });
    } catch {
      notCreated[creationId] = { type: "invalidProperties", properties: ["name"], description: "A folder with that name already exists" };
      continue;
    }
    const jmapId = encodeMailboxRef({ kind: "folder", mailboxId: mailbox.id, folderId: id });
    ctx.createdIds[creationId] = jmapId;
    created[creationId] = { id: jmapId, role: null, sortOrder: 0, totalEmails: 0, unreadEmails: 0, totalThreads: 0, unreadThreads: 0, isSubscribed: true };
  }
  for (const [id, patch] of Object.entries(args.update ?? {})) {
    const ref = decodeMailboxRef(id);
    const mailbox = ref && accessible.find((row) => row.id === ref.mailboxId);
    if (!ref || !mailbox) {
      notUpdated[id] = { type: "notFound" };
      continue;
    }
    const keys = Object.keys(patch).filter((key) => key !== "isSubscribed" && key !== "sortOrder");
    if (ref.kind !== "folder") {
      notUpdated[id] = keys.length ? { type: "forbidden", description: "System mailboxes cannot be changed" } : void 0;
      if (!keys.length) updated[id] = null;
      continue;
    }
    if (keys.some((key) => key !== "name")) {
      notUpdated[id] = { type: "invalidProperties", properties: keys.filter((key) => key !== "name") };
      continue;
    }
    if (typeof patch.name === "string" && patch.name.trim()) {
      await ctx.db.update(folders).set({ name: patch.name.trim() }).where(and5(eq6(folders.id, ref.folderId), eq6(folders.mailboxId, mailbox.id)));
    }
    updated[id] = null;
  }
  for (const id of args.destroy ?? []) {
    const ref = decodeMailboxRef(id);
    const mailbox = ref && accessible.find((row) => row.id === ref.mailboxId);
    if (!ref || !mailbox) {
      notDestroyed[id] = { type: "notFound" };
      continue;
    }
    if (ref.kind !== "folder" || mailbox.permission !== "full_access") {
      notDestroyed[id] = { type: "forbidden" };
      continue;
    }
    if (args.onDestroyRemoveEmails) {
      await ctx.db.update(messages).set({ status: "trash", folderId: null }).where(eq6(messages.folderId, ref.folderId));
    } else {
      const [inUse] = await ctx.db.select({ n: count() }).from(messages).where(and5(eq6(messages.folderId, ref.folderId), isNull(messages.snoozedUntil)));
      if ((inUse?.n ?? 0) > 0) {
        notDestroyed[id] = { type: "mailboxHasEmail" };
        continue;
      }
    }
    await ctx.db.delete(folders).where(and5(eq6(folders.id, ref.folderId), eq6(folders.mailboxId, mailbox.id)));
    destroyed.push(id);
  }
  return {
    accountId: ctx.accountId,
    oldState,
    newState: await getMailboxState(ctx),
    created,
    updated,
    destroyed,
    notCreated,
    notUpdated,
    notDestroyed
  };
};
function pick(item, properties) {
  if (!properties) return item;
  const result = { id: item.id };
  for (const key of properties) if (key in item) result[key] = item[key];
  return result;
}

// src/lib/jmap/emails.ts
import { and as and11, asc as asc4, count as count2, desc as desc2, eq as eq13, inArray as inArray7, sql as sql5 } from "drizzle-orm";

// src/lib/email/parse.ts
import PostalMime from "postal-mime";

// src/lib/email/address.ts
function quoteDisplayName(name) {
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function formatEmailAddress(address, name) {
  const normalizedAddress = address.trim();
  const normalizedName = name?.trim();
  if (!normalizedName) return normalizedAddress;
  return `${quoteDisplayName(normalizedName)} <${normalizedAddress}>`;
}
function parseEmailAddressParts(value) {
  const trimmed = value.trim();
  const headerMatch = trimmed.match(/^(?:"([^"]+)"|([^<"]+))\s*<([^>]+)>$/);
  if (headerMatch) {
    return {
      name: (headerMatch[1] ?? headerMatch[2] ?? "").trim() || null,
      address: headerMatch[3].trim()
    };
  }
  return { name: null, address: trimmed };
}
function getEmailAddress(value) {
  return parseEmailAddressParts(value).address;
}
function normalizeEmailAddress(value) {
  return getEmailAddress(value).trim().toLowerCase();
}
function formatPostalAddress(address, fallback) {
  const [mailbox] = getPostalMailboxes(address);
  if (!mailbox?.address) return fallback;
  return formatEmailAddress(mailbox.address, mailbox.name);
}
function formatPostalAddressList(addresses, fallback) {
  const mailboxes2 = (addresses ?? []).flatMap(getPostalMailboxes).filter((item) => !!item.address);
  if (mailboxes2.length === 0) return fallback;
  return mailboxes2.map((mailbox) => formatEmailAddress(mailbox.address, mailbox.name)).join(", ");
}
function getPostalMailboxes(address) {
  if (!address) return [];
  if ("address" in address && address.address) return [address];
  return address.group ?? [];
}
function splitEmailAddressList(value) {
  const result = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  for (const char of value ?? "") {
    if (char === '"' && !inAngle) inQuotes = !inQuotes;
    else if (char === "<" && !inQuotes) inAngle = true;
    else if (char === ">" && !inQuotes) inAngle = false;
    if ((char === "," || char === ";") && !inQuotes && !inAngle) {
      if (current.trim()) result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
function getEmailAddressList(value) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const entry of splitEmailAddressList(value)) {
    const address = normalizeEmailAddress(entry);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    result.push(address);
  }
  return result;
}
function joinEmailAddressList(values) {
  return values.map((value) => value.trim()).filter(Boolean).join(", ");
}

// src/lib/email/threading.ts
import { and as and6, asc as asc2, eq as eq7, inArray as inArray4 } from "drizzle-orm";

// src/lib/email/thread-lookup.ts
function normalizeMessageId(value) {
  const trimmed = (value ?? "").trim().replace(/^<|>$/g, "").trim();
  return trimmed || null;
}
function selectThreadLookupIds(inReplyTo, references) {
  const MAX_THREAD_LOOKUP_IDS = 40;
  const candidates = /* @__PURE__ */ new Set();
  const add = (value) => {
    const id = normalizeMessageId(value);
    if (id) candidates.add(id);
  };
  add(inReplyTo);
  add(references[0]);
  for (let index = references.length - 1; index >= 1 && candidates.size < MAX_THREAD_LOOKUP_IDS; index--) {
    add(references[index]);
  }
  return Array.from(candidates);
}

// src/lib/email/threading.ts
function parseMessageIdList(value) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const token of (value ?? "").split(/[\s,]+/)) {
    const id = normalizeMessageId(token);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
function formatMessageIdHeader(ids) {
  return ids.map((id) => `<${id}>`).join(" ");
}
async function resolveThreadId(db, input) {
  const candidates = selectThreadLookupIds(input.inReplyTo, input.references ?? []);
  if (input.mailboxId && candidates.length > 0) {
    const variants = candidates.flatMap((id) => [id, `<${id}>`]);
    const [parent] = await db.select({ threadId: messages.threadId, providerMessageId: messages.providerMessageId }).from(messages).where(and6(eq7(messages.mailboxId, input.mailboxId), inArray4(messages.providerMessageId, variants))).orderBy(asc2(messages.createdAt)).limit(1);
    if (parent) {
      return parent.threadId ?? normalizeMessageId(parent.providerMessageId) ?? newId("thr");
    }
  }
  return normalizeMessageId(input.messageId) ?? newId("thr");
}

// src/lib/email/attachments.ts
import { and as and7, eq as eq8, isNull as isNull2 } from "drizzle-orm";
var MAX_ATTACHMENT_SIZE = 25e6;
var MAX_TOTAL_ATTACHMENT_SIZE = 25e6;
var MAX_ATTACHMENT_COUNT = 10;
function decodeBase64Content(content) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
function normalizeAttachmentContent(content, encoding) {
  if (content instanceof ArrayBuffer) return content;
  if (content instanceof Uint8Array) {
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  }
  if (encoding === "base64") return decodeBase64Content(content);
  return new TextEncoder().encode(content).buffer;
}
function sanitizeFilename(filename) {
  const normalized = filename.trim().replace(/[/\\\0]/g, "_");
  return normalized || "attachment";
}
function validateAttachments(attachments) {
  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`A message can include at most ${MAX_ATTACHMENT_COUNT} attachments`);
  }
  let totalSize = 0;
  for (const attachment of attachments) {
    const size = attachment.content.byteLength;
    if (size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`${attachment.filename} exceeds the 25 MB attachment limit`);
    }
    totalSize += size;
  }
  if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    throw new Error("Attachments exceed the 25 MB total limit");
  }
}
async function storeMessageAttachments(env2, messageId, attachments, options) {
  if (options?.validate !== false) validateAttachments(attachments);
  const db = getDb(env2);
  const stored = [];
  try {
    for (const attachment of attachments) {
      const id = newId("att");
      const filename = sanitizeFilename(attachment.filename);
      const r2Key = `attachments/${messageId}/${id}/${filename}`;
      const disposition = attachment.disposition ?? "attachment";
      await env2.BUCKET.put(r2Key, attachment.content, {
        httpMetadata: { contentType: attachment.type },
        customMetadata: { filename, messageId }
      });
      stored.push({
        id,
        messageId,
        filename,
        type: attachment.type,
        size: attachment.content.byteLength,
        disposition,
        contentId: attachment.contentId ?? null,
        r2Key
      });
      await db.insert(messageAttachments).values({
        id,
        messageId,
        filename,
        contentType: attachment.type,
        size: attachment.content.byteLength,
        disposition,
        contentId: attachment.contentId ?? null,
        r2Key
      });
    }
  } catch (error) {
    await Promise.all(stored.map((attachment) => env2.BUCKET.delete(attachment.r2Key)));
    throw error;
  }
  return stored;
}
async function loadMessageAttachmentContents(env2, messageId) {
  const db = getDb(env2);
  const rows = await db.select().from(messageAttachments).where(and7(eq8(messageAttachments.messageId, messageId), isNull2(messageAttachments.trashedAt)));
  const result = [];
  for (const row of rows) {
    const object = await env2.BUCKET.get(row.r2Key);
    if (!object) continue;
    result.push({
      storageId: row.id,
      filename: row.filename,
      type: row.contentType,
      content: await object.arrayBuffer(),
      disposition: row.disposition,
      contentId: row.contentId
    });
  }
  return result;
}
async function deleteMessageAttachmentObjects(env2, messageId) {
  const db = getDb(env2);
  const rows = await db.select({ r2Key: messageAttachments.r2Key }).from(messageAttachments).where(eq8(messageAttachments.messageId, messageId));
  await Promise.all(rows.map((row) => env2.BUCKET.delete(row.r2Key)));
}

// src/lib/email/reply-content-utils.ts
var ORIGINAL_MESSAGE_RE = /^-{2,}\s*Original Message\s*-{2,}$/i;
var UNDERSCORE_SEPARATOR_RE = /^_{8,}$/;
var WROTE_RE = /^On\s+(.+?)\s+wrote:\s*$/i;
var HEADER_RE = /^(From|To|Cc|Subject|Date|Sent):\s*(.*)$/i;
function splitRepliedEmailContent(content, options = {}) {
  const lines = normalizeContent(content).split("\n");
  const originalMessageIndex = lines.findIndex((line) => ORIGINAL_MESSAGE_RE.test(line.trim()));
  if (originalMessageIndex >= 0) {
    return splitOriginalMessage(lines, originalMessageIndex, options);
  }
  const underscoreSeparatorIndex = lines.findIndex((line) => UNDERSCORE_SEPARATOR_RE.test(line.trim()));
  if (underscoreSeparatorIndex >= 0) {
    return splitSeparatorQuotedContent(lines, underscoreSeparatorIndex, options);
  }
  const wroteIndex = lines.findIndex((line) => WROTE_RE.test(line.trim()));
  if (wroteIndex >= 0) {
    const markerLine = lines[wroteIndex]?.trim() ?? "";
    const quotedLines = stripSingleQuotePrefix(lines.slice(wroteIndex + 1));
    return {
      latestContent: trimEmptyLines(lines.slice(0, wroteIndex)).join("\n").trim(),
      quotedContent: buildQuotedContent(
        quotedLines,
        getWroteDateLine(markerLine),
        getPreviousMessageDirection(getWroteAddress(markerLine), options.ownAddress),
        options
      )
    };
  }
  const quoteIndex = lines.findIndex((line) => line.trim().startsWith(">"));
  if (quoteIndex >= 0) {
    const quotedLines = stripSingleQuotePrefix(lines.slice(quoteIndex));
    return {
      latestContent: trimEmptyLines(lines.slice(0, quoteIndex)).join("\n").trim(),
      quotedContent: buildQuotedContent(
        quotedLines,
        "Unknown time",
        "received",
        options
      )
    };
  }
  return { latestContent: normalizeContent(content).trim(), quotedContent: [] };
}
function getLatestEmailContent(content) {
  return splitRepliedEmailContent(content).latestContent;
}
function htmlToReadableText(html) {
  return (html ?? "").replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|blockquote|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function splitOriginalMessage(lines, markerIndex, options) {
  const latestContent = trimEmptyLines(lines.slice(0, markerIndex)).join("\n").trim();
  const quotedLines = lines.slice(markerIndex + 1);
  const headers = /* @__PURE__ */ new Map();
  let contentStartIndex = 0;
  for (let index = 0; index < quotedLines.length; index += 1) {
    const line = quotedLines[index] ?? "";
    if (!line.trim()) {
      contentStartIndex = index + 1;
      break;
    }
    const match = line.match(HEADER_RE);
    if (match) {
      headers.set(match[1].toLowerCase(), match[2].trim());
      contentStartIndex = index + 1;
    }
  }
  const quotedContent = buildQuotedContent(
    stripSingleQuotePrefix(quotedLines.slice(contentStartIndex)),
    headers.get("date") ?? headers.get("sent") ?? "Unknown time",
    getPreviousMessageDirection(headers.get("from"), options.ownAddress),
    options
  );
  return { latestContent, quotedContent };
}
function splitSeparatorQuotedContent(lines, separatorIndex, options) {
  const quotedLines = trimEmptyLines(lines.slice(separatorIndex + 1));
  return {
    latestContent: trimEmptyLines(lines.slice(0, separatorIndex)).join("\n").trim(),
    quotedContent: buildQuotedContent(
      quotedLines,
      getHeaderValue(quotedLines, "sent") ?? getHeaderValue(quotedLines, "date") ?? "Unknown time",
      getPreviousMessageDirection(getHeaderValue(quotedLines, "from"), options.ownAddress),
      options
    )
  };
}
function getWroteDateLine(line) {
  const match = line.match(WROTE_RE);
  const rawDateLine = match?.[1]?.trim() ?? "";
  return rawDateLine.replace(/,\s*["']?[^,<"]+["']?\s*<[^>]+>\s*$/i, "").replace(/\b([0-9]{1,2}:[0-9]{2}\s?(?:AM|PM))(?:,?\s+.*)?$/i, "$1").trim() || "Unknown time";
}
function getWroteAddress(line) {
  return line.match(/<([^>]+@[^>]+)>/)?.[1];
}
function normalizeContent(content) {
  return (content ?? "").replace(/\r\n?/g, "\n");
}
function stripSingleQuotePrefix(lines) {
  return trimEmptyLines(lines.map((line) => line.replace(/^\s*>\s?/, "")));
}
function trimEmptyLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start]?.trim()) start += 1;
  while (end > start && !lines[end - 1]?.trim()) end -= 1;
  return lines.slice(start, end);
}
function hasQuotedContent(quotedContent) {
  return quotedContent.content.trim().length > 0 || quotedContent.quotedContent.length > 0;
}
function buildQuotedContent(lines, dateLine, direction, options) {
  const rawContent = trimEmptyLines(lines).join("\n").trim();
  if (!rawContent) return [];
  const nested = splitRepliedEmailContent(rawContent, options);
  const quotedContent = {
    dateLine,
    direction,
    content: nested.latestContent,
    quotedContent: nested.quotedContent
  };
  return hasQuotedContent(quotedContent) ? [quotedContent] : [];
}
function getPreviousMessageDirection(from, ownAddress) {
  if (!from || !ownAddress) return "received";
  const fromAddress = normalizeEmailAddress(
    from.match(/<([^>]+)>/)?.[1] ?? from
  );
  return fromAddress === normalizeEmailAddress(ownAddress) ? "sent" : "received";
}
function getHeaderValue(lines, name) {
  for (const line of lines) {
    const match = line.match(HEADER_RE);
    if (match?.[1].toLowerCase() === name) return match[2].trim();
  }
  return void 0;
}

// src/lib/email/parse.ts
async function parseRawMime(raw) {
  const email = await PostalMime.parse(raw);
  const date = email.date ? new Date(email.date) : null;
  return {
    subject: email.subject ?? null,
    text: email.text ?? null,
    html: email.html ?? null,
    messageId: email.messageId ?? null,
    fromAddr: formatPostalAddress(email.from, null),
    toAddr: formatPostalAddressList(email.to, null),
    ccAddr: formatPostalAddressList(email.cc, null),
    bccAddr: formatPostalAddressList(email.bcc, null),
    replyTo: formatPostalAddressList(email.replyTo, null),
    inReplyTo: normalizeMessageId(email.inReplyTo),
    references: parseMessageIdList(email.references),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    attachments: email.attachments.map((attachment, index) => ({
      filename: attachment.filename ?? `attachment-${index + 1}`,
      type: attachment.mimeType || "application/octet-stream",
      content: normalizeAttachmentContent(attachment.content, attachment.encoding),
      disposition: attachment.disposition === "inline" ? "inline" : "attachment",
      contentId: attachment.contentId ?? null
    }))
  };
}
function buildSnippet(text, html, max = 200) {
  const source = getLatestEmailContent(text?.trim() || htmlToReadableText(html));
  return source.replace(/\s+/g, " ").trim().slice(0, max);
}

// src/lib/email/sender.ts
import { eq as eq9 } from "drizzle-orm";

// src/lib/profile/identity-utils.ts
function mailboxAddress(mailbox) {
  return `${mailbox.localPart}@${mailbox.hostname}`.trim().toLowerCase();
}
function isPrimaryMailbox(mailbox, accountEmail) {
  if (!accountEmail) return false;
  return mailboxAddress(mailbox) === accountEmail.trim().toLowerCase();
}
function tracksAccountIdentity(mailbox, accountEmail) {
  return mailbox.type === "personal" && isPrimaryMailbox(mailbox, accountEmail);
}
function resolveMailboxDisplayName(mailbox, accountEmail, accountName) {
  return tracksAccountIdentity(mailbox, accountEmail) ? accountName : mailbox.displayName;
}

// src/lib/email/sender.ts
async function getAuthorizedSenderAddress(env2, input) {
  if (!input.mailboxId) throw new Error("Mailbox is required");
  const db = getDb(env2);
  const [mailbox] = await db.select({
    localPart: mailboxes.localPart,
    displayName: mailboxes.displayName,
    type: mailboxes.type,
    ownerName: users.name,
    ownerEmail: users.email,
    hostname: domains.hostname,
    domainId: mailboxes.domainId,
    useAllDomains: mailboxes.useAllDomains,
    id: mailboxes.id
  }).from(mailboxes).innerJoin(domains, eq9(mailboxes.domainId, domains.id)).innerJoin(users, eq9(mailboxes.userId, users.id)).where(eq9(mailboxes.id, input.mailboxId)).limit(1);
  if (!mailbox) throw new Error("Mailbox not found");
  const [actor] = await db.select().from(users).where(eq9(users.id, input.userId)).limit(1);
  if (!actor || actor.disabled) throw new Error("Sender account not found");
  const access = await getMailboxAccessLevel(db, actor, mailbox.id);
  if (!access?.canSendOnBehalf) {
    throw new Error("You do not have permission to send from this mailbox");
  }
  const requestedAddress = getEmailAddress(input.from);
  const permittedAddresses = await getMailboxDomainAddresses(db, mailbox);
  if (!permittedAddresses.includes(requestedAddress.toLowerCase())) {
    throw new Error("Sender address does not match the selected mailbox");
  }
  const senderAddress = requestedAddress.toLowerCase();
  const senderName = resolveMailboxDisplayName(mailbox, mailbox.ownerEmail, mailbox.ownerName);
  if (access.canSendAs) {
    return {
      fromAddr: formatEmailAddress(senderAddress, senderName),
      mailboxId: mailbox.id
    };
  }
  const mailboxName = senderName || senderAddress;
  return {
    fromAddr: formatEmailAddress(senderAddress, `${actor.name} on behalf of ${mailboxName}`),
    mailboxId: mailbox.id
  };
}

// src/lib/email/message-cleanup.ts
import { eq as eq10 } from "drizzle-orm";
async function deleteMessageWithObjects(env2, db, id, rawR2Key) {
  await deleteMessageAttachmentObjects(env2, id);
  if (rawR2Key) await env2.BUCKET.delete(rawR2Key);
  await db.delete(messages).where(eq10(messages.id, id));
}

// src/lib/jmap/email-objects.ts
import { and as and8, inArray as inArray5, isNull as isNull3 } from "drizzle-orm";
function toAddressObjects(value) {
  const entries = splitEmailAddressList(value);
  if (entries.length === 0) return null;
  return entries.map((entry) => {
    const parts = parseEmailAddressParts(entry);
    return { name: parts.name, email: parts.address };
  });
}
function mailboxIdsFor(row) {
  if (!row.mailboxId) return {};
  if (row.folderId) return { [encodeMailboxRef({ kind: "folder", mailboxId: row.mailboxId, folderId: row.folderId })]: true };
  const role = statusToRole(row.status);
  return role ? { [encodeMailboxRef({ kind: "role", mailboxId: row.mailboxId, role })]: true } : {};
}
function keywordsFor(row) {
  const keywords = {};
  if (row.read || row.direction === "outbound") keywords[KEYWORD_SEEN] = true;
  if (row.starred) keywords[KEYWORD_FLAGGED] = true;
  if (row.status === "draft") keywords[KEYWORD_DRAFT] = true;
  return keywords;
}
function threadIdFor(row) {
  return row.threadId ?? row.id;
}
function stripBrackets(value) {
  const trimmed = value?.trim().replace(/^<|>$/g, "");
  return trimmed || null;
}
function bodyPart(partId, type, size) {
  return { partId, blobId: null, size, headers: [], name: null, type, charset: "utf-8", disposition: null, cid: null, language: null, location: null };
}
function attachmentPart(attachment) {
  return {
    partId: null,
    blobId: attachmentBlobId(attachment.id),
    size: attachment.size,
    headers: [],
    name: attachment.filename,
    type: attachment.contentType,
    charset: null,
    disposition: attachment.disposition,
    cid: attachment.contentId ? attachment.contentId.replace(/^<|>$/g, "") : null,
    language: null,
    location: null
  };
}
function buildEmailObject(row, attachments, options) {
  const text = row.textBody ?? "";
  const html = row.htmlBody ?? "";
  const textSize = new TextEncoder().encode(text).length;
  const htmlSize = new TextEncoder().encode(html).length;
  const textPart = text ? bodyPart("1", "text/plain", textSize) : null;
  const htmlPart = html ? bodyPart("2", "text/html", htmlSize) : null;
  const inline = attachments.filter((item) => item.disposition === "inline");
  const attached = attachments.filter((item) => item.disposition !== "inline");
  let structure;
  const bodyParts = [textPart, htmlPart].filter((part) => !!part);
  const alternative = bodyParts.length > 1 ? { partId: null, blobId: null, size: textSize + htmlSize, name: null, type: "multipart/alternative", charset: null, disposition: null, cid: null, language: null, location: null, subParts: bodyParts } : bodyParts[0] ?? bodyPart("1", "text/plain", 0);
  if (attachments.length > 0) {
    structure = { partId: null, blobId: null, size: 0, name: null, type: "multipart/mixed", charset: null, disposition: null, cid: null, language: null, location: null, subParts: [alternative, ...inline.map(attachmentPart), ...attached.map(attachmentPart)] };
  } else {
    structure = alternative;
  }
  const bodyValues = {};
  if (options.fetchBodies) {
    const clip = (value) => {
      const limit = options.maxBodyValueBytes;
      if (!limit || value.length <= limit) return { value, isEncodingProblem: false, isTruncated: false };
      return { value: value.slice(0, limit), isEncodingProblem: false, isTruncated: true };
    };
    if (textPart) bodyValues["1"] = clip(text);
    if (htmlPart) bodyValues["2"] = clip(html);
  }
  const size = textSize + htmlSize + attachments.reduce((total, item) => total + item.size, 0);
  const preview = (row.snippet ?? htmlToReadableText(html) ?? text).replace(/\s+/g, " ").trim().slice(0, 256);
  const references = row.references ? row.references.split(/\s+/).filter(Boolean) : null;
  const from = toAddressObjects(row.fromAddr);
  const sentAt = row.createdAt.toISOString();
  return {
    id: row.id,
    blobId: messageBlobId(row.id),
    threadId: threadIdFor(row),
    mailboxIds: mailboxIdsFor(row),
    keywords: keywordsFor(row),
    size,
    receivedAt: sentAt,
    messageId: stripBrackets(row.providerMessageId) ? [stripBrackets(row.providerMessageId)] : null,
    inReplyTo: row.inReplyTo ? [row.inReplyTo] : null,
    references,
    sender: from,
    from,
    to: toAddressObjects(row.toAddr),
    cc: toAddressObjects(row.ccAddr),
    bcc: toAddressObjects(row.bccAddr),
    replyTo: toAddressObjects(row.replyTo),
    subject: row.subject,
    sentAt,
    hasAttachment: attached.length > 0,
    preview,
    bodyStructure: structure,
    bodyValues,
    textBody: textPart ? [textPart] : htmlPart ? [htmlPart] : [],
    htmlBody: htmlPart ? [htmlPart] : textPart ? [textPart] : [],
    attachments: [...inline, ...attached].map(attachmentPart)
  };
}
async function loadAttachmentsByMessage(ctx, messageIds) {
  const result = /* @__PURE__ */ new Map();
  if (messageIds.length === 0) return result;
  const unique = [...new Set(messageIds)];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const rows = await ctx.db.select().from(messageAttachments).where(and8(inArray5(messageAttachments.messageId, unique.slice(offset, offset + 100)), isNull3(messageAttachments.trashedAt)));
    for (const row of rows) {
      const list = result.get(row.messageId) ?? [];
      list.push(row);
      result.set(row.messageId, list);
    }
  }
  return result;
}
function resolveHeaderProperty(row, property) {
  const [, name, form] = property.split(":");
  const lower = (name ?? "").toLowerCase();
  const raw = (() => {
    switch (lower) {
      case "subject":
        return row.subject;
      case "from":
        return row.fromAddr;
      case "to":
        return row.toAddr;
      case "cc":
        return row.ccAddr;
      case "bcc":
        return row.bccAddr;
      case "message-id":
        return row.providerMessageId;
      case "in-reply-to":
        return row.inReplyTo ? `<${row.inReplyTo}>` : null;
      case "references":
        return row.references ? row.references.split(/\s+/).map((id) => `<${id}>`).join(" ") : null;
      case "date":
        return row.createdAt.toUTCString();
      default:
        return null;
    }
  })();
  if (raw == null) return null;
  switch ((form ?? "asRaw").toLowerCase()) {
    case "asaddresses":
      return toAddressObjects(raw);
    case "asmessageids":
      return raw.split(/\s+/).map((id) => id.replace(/^<|>$/g, "")).filter(Boolean);
    case "asdate":
      return row.createdAt.toISOString();
    case "astext":
      return raw;
    default:
      return ` ${raw}`;
  }
}

// src/lib/jmap/email-import-utils.ts
function idSetToList(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).filter(([, on]) => !!on).map(([id]) => id);
}
function importFlags(keywords) {
  const set = new Set(idSetToList(keywords));
  return { read: set.has(KEYWORD_SEEN), starred: set.has(KEYWORD_FLAGGED) };
}
function parseReceivedAt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date2 = new Date(value < 1e12 ? value * 1e3 : value);
    return Number.isNaN(date2.getTime()) ? null : date2;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}
function resolveDraftsMailbox(mailboxIds, writable) {
  const ids = idSetToList(mailboxIds);
  const invalid = (description) => ({ error: { type: "invalidProperties", properties: ["mailboxIds"], description } });
  if (ids.length !== 1) return invalid("A message belongs to exactly one mailbox");
  const ref = decodeMailboxRef(ids[0]);
  if (!ref || !writable.has(ref.mailboxId)) return invalid("Unknown mailbox");
  if (ref.kind !== "role" || ref.role !== "drafts") return invalid("New messages can only be created in a Drafts mailbox");
  return { mailboxId: ref.mailboxId };
}

// src/lib/jmap/email-query.ts
import { and as and9, asc as asc3, desc, eq as eq11, exists, gt as gt2, gte, inArray as inArray6, isNotNull, isNull as isNull4, lt, ne, not, or, sql as sql4 } from "drizzle-orm";
function mailboxRefCondition(ref) {
  const base = eq11(messages.mailboxId, ref.mailboxId);
  if (ref.kind === "account") return base;
  if (ref.kind === "folder") return and9(base, eq11(messages.folderId, ref.folderId));
  const status = roleToStatus(ref.role);
  if (ref.role === "inbox") return and9(base, eq11(messages.status, status), isNull4(messages.folderId));
  if (ref.role === "sent") return and9(base, inArray6(messages.status, ["sent", "queued", "failed"]), isNull4(messages.folderId));
  return and9(base, eq11(messages.status, status), isNull4(messages.folderId));
}
function keywordCondition(keyword, present) {
  switch (keyword) {
    case KEYWORD_SEEN:
      return present ? or(eq11(messages.read, true), eq11(messages.direction, "outbound")) : and9(eq11(messages.read, false), eq11(messages.direction, "inbound"));
    case KEYWORD_FLAGGED:
      return eq11(messages.starred, present);
    case KEYWORD_DRAFT:
      return present ? eq11(messages.status, "draft") : ne(messages.status, "draft");
    default:
      return present ? matchNothing : matchEverything;
  }
}
function likeEscape(value) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}
function likePattern(value) {
  return `%${likeEscape(value)}%`;
}
function headerCondition(header) {
  if (!Array.isArray(header) || header.length < 1 || header.length > 2 || typeof header[0] !== "string") {
    throw invalidArguments("header must be [name] or [name, value]");
  }
  const name = header[0].trim().toLowerCase();
  const value = header.length === 2 ? normalizeMessageId(String(header[1])) : null;
  switch (name) {
    case "message-id":
      if (header.length === 1) return isNotNull(messages.providerMessageId);
      return value ? inArray6(messages.providerMessageId, [value, `<${value}>`]) : matchNothing;
    case "in-reply-to":
      if (header.length === 1) return isNotNull(messages.inReplyTo);
      return value ? inArray6(messages.inReplyTo, [value, `<${value}>`]) : matchNothing;
    case "references":
      if (header.length === 1) return isNotNull(messages.references);
      return value ? insensitiveLike(concatText(" ", sql4`coalesce(${messages.references}, '')`, " "), `% ${likeEscape(value)} %`) : matchNothing;
    default:
      throw unsupportedFilter(`Cannot filter on the ${header[0]} header`);
  }
}
function conditionToSql(condition, accessible) {
  const parts = [];
  if (condition.inMailbox !== void 0) {
    const ref = decodeMailboxRef(condition.inMailbox);
    if (!ref || !accessible.has(ref.mailboxId)) throw invalidArguments(`Unknown mailbox ${condition.inMailbox}`);
    parts.push(mailboxRefCondition(ref));
  }
  if (condition.inMailboxOtherThan) {
    for (const id of condition.inMailboxOtherThan) {
      const ref = decodeMailboxRef(id);
      if (ref && accessible.has(ref.mailboxId)) parts.push(not(mailboxRefCondition(ref)));
    }
  }
  if (condition.before) parts.push(lt(messages.createdAt, new Date(condition.before)));
  if (condition.after) parts.push(gte(messages.createdAt, new Date(condition.after)));
  if (condition.hasKeyword) parts.push(keywordCondition(condition.hasKeyword, true));
  if (condition.notKeyword) parts.push(keywordCondition(condition.notKeyword, false));
  if (condition.someInThreadHaveKeyword) parts.push(keywordCondition(condition.someInThreadHaveKeyword, true));
  if (condition.allInThreadHaveKeyword) parts.push(keywordCondition(condition.allInThreadHaveKeyword, true));
  if (condition.noneInThreadHaveKeyword) parts.push(keywordCondition(condition.noneInThreadHaveKeyword, false));
  if (condition.from) parts.push(insensitiveLike(messages.fromAddr, likePattern(condition.from)));
  if (condition.to) parts.push(insensitiveLike(messages.toAddr, likePattern(condition.to)));
  if (condition.cc) parts.push(insensitiveLike(messages.ccAddr, likePattern(condition.cc)));
  if (condition.bcc) parts.push(insensitiveLike(messages.bccAddr, likePattern(condition.bcc)));
  if (condition.subject) parts.push(insensitiveLike(messages.subject, likePattern(condition.subject)));
  if (condition.body) parts.push(or(insensitiveLike(messages.textBody, likePattern(condition.body)), insensitiveLike(messages.htmlBody, likePattern(condition.body))));
  if (condition.text) {
    const pattern = likePattern(condition.text);
    parts.push(
      or(
        insensitiveLike(messages.subject, pattern),
        insensitiveLike(messages.fromAddr, pattern),
        insensitiveLike(messages.toAddr, pattern),
        insensitiveLike(messages.ccAddr, pattern),
        insensitiveLike(messages.textBody, pattern),
        insensitiveLike(messages.snippet, pattern)
      )
    );
  }
  if (condition.header) parts.push(headerCondition(condition.header));
  if (condition.hasAttachment !== void 0) {
    const hasOne = exists(
      sql4`(SELECT 1 FROM ${messageAttachments} WHERE ${messageAttachments.messageId} = ${messages.id} AND ${messageAttachments.disposition} = 'attachment')`
    );
    parts.push(condition.hasAttachment ? hasOne : not(hasOne));
  }
  if (condition.minSize !== void 0) parts.push(gte(sql4`length(coalesce(${messages.textBody}, '')) + length(coalesce(${messages.htmlBody}, ''))`, condition.minSize));
  if (condition.maxSize !== void 0) parts.push(lt(sql4`length(coalesce(${messages.textBody}, '')) + length(coalesce(${messages.htmlBody}, ''))`, condition.maxSize));
  return parts;
}
function filterToSql(filter, accessible) {
  if (!filter) return void 0;
  if ("operator" in filter) {
    const children = (filter.conditions ?? []).map((child) => filterToSql(child, accessible)).filter((part) => !!part);
    if (children.length === 0) return void 0;
    if (filter.operator === "AND") return and9(...children);
    if (filter.operator === "OR") return or(...children);
    if (filter.operator === "NOT") return not(and9(...children));
    throw invalidArguments(`Unknown operator ${String(filter.operator)}`);
  }
  const parts = conditionToSql(filter, accessible);
  return parts.length ? and9(...parts) : void 0;
}
function sortToSql(sort) {
  const comparators = sort && sort.length ? sort : [{ property: "receivedAt", isAscending: false }];
  return comparators.map((item) => {
    const direction = item.isAscending ? asc3 : desc;
    switch (item.property) {
      case "receivedAt":
      case "sentAt":
        return direction(messages.createdAt);
      case "subject":
        return direction(messages.subject);
      case "from":
        return direction(messages.fromAddr);
      case "to":
        return direction(messages.toAddr);
      case "size":
        return direction(sql4`length(coalesce(${messages.textBody}, '')) + length(coalesce(${messages.htmlBody}, ''))`);
      case "hasKeyword":
      case "allInThreadHaveKeyword":
      case "someInThreadHaveKeyword": {
        const keyword = item.keyword ?? KEYWORD_SEEN;
        return direction(keyword === KEYWORD_FLAGGED ? messages.starred : messages.read);
      }
      default:
        throw invalidArguments(`Cannot sort by ${item.property}`);
    }
  });
}

// src/lib/jmap/blobs.ts
import { and as and10, eq as eq12, isNull as isNull5 } from "drizzle-orm";
var UPLOAD_PREFIX = "jmap-uploads";
function uploadKey(ctx, uploadId) {
  return `${UPLOAD_PREFIX}/${ctx.auth.userId}/${uploadId}`;
}
async function readUpload(ctx, uploadId) {
  const object = await ctx.env.BUCKET.get(uploadKey(ctx, uploadId));
  if (!object) return null;
  return { content: await object.arrayBuffer(), type: object.httpMetadata?.contentType ?? "application/octet-stream", name: object.customMetadata?.name ?? null };
}
async function deleteUpload(ctx, uploadId) {
  await ctx.env.BUCKET.delete(uploadKey(ctx, uploadId));
}
async function storeRawDraftMime(ctx, messageId, raw) {
  const key = `drafts/${messageId}.eml`;
  await ctx.env.BUCKET.put(key, raw, {
    httpMetadata: { contentType: "message/rfc822" },
    customMetadata: { userId: ctx.auth.userId, messageId }
  });
  return key;
}

// src/lib/jmap/emails.ts
async function insertDraft(ctx, row) {
  const id = newId("msg");
  await ctx.db.insert(messages).values({
    id,
    userId: ctx.auth.userId,
    mailboxId: row.mailboxId,
    direction: "outbound",
    fromAddr: row.fromAddr,
    toAddr: row.toAddr,
    ccAddr: row.ccAddr,
    bccAddr: row.bccAddr,
    subject: row.subject,
    snippet: buildSnippet(row.textBody, row.htmlBody),
    textBody: row.textBody,
    htmlBody: row.htmlBody,
    status: "draft",
    read: row.read ?? true,
    starred: row.starred ?? false,
    inReplyTo: row.inReplyTo,
    references: row.references,
    threadId: row.threadId ?? null,
    providerMessageId: row.providerMessageId ?? null,
    rawR2Key: row.rawR2Key ?? null,
    ...row.createdAt ? { createdAt: row.createdAt } : {}
  });
  return id;
}
async function scope(ctx) {
  const ids = Array.from(await listAccessibleMailboxIdSet(ctx));
  return { ids, condition: ids.length ? inArray7(messages.mailboxId, ids) : ctx.auth.mailboxIds ? sql5`1 = 0` : eq13(messages.userId, ctx.auth.userId) };
}
async function loadMessages(ctx, ids) {
  if (ids.length === 0) return [];
  const { ids: accessible, condition } = await scope(ctx);
  const batch = Math.max(1, 100 - accessible.length);
  const unique = [...new Set(ids)];
  const rows = [];
  for (let offset = 0; offset < unique.length; offset += batch) {
    rows.push(...await ctx.db.select().from(messages).where(and11(condition, inArray7(messages.id, unique.slice(offset, offset + batch)))));
  }
  return rows;
}
var emailGet = async (ctx, args) => {
  const ids = args.ids;
  if (!ids) throw new JmapError("requestTooLarge", "Email/get needs an explicit list of ids");
  if (ids.length > LIMITS.maxObjectsInGet) throw new JmapError("requestTooLarge");
  const properties = args.properties;
  const fetchBodies = !!(args.fetchTextBodyValues || args.fetchHTMLBodyValues || args.fetchAllBodyValues);
  const maxBodyValueBytes = Number(args.maxBodyValueBytes ?? 0);
  const rows = await loadMessages(ctx, ids);
  const attachments = await loadAttachmentsByMessage(ctx, rows.map((row) => row.id));
  const found = /* @__PURE__ */ new Set();
  const list = rows.map((row) => {
    found.add(row.id);
    const full = buildEmailObject(row, attachments.get(row.id) ?? [], { fetchBodies, maxBodyValueBytes });
    if (!properties) return full;
    const picked = { id: row.id };
    for (const key of properties) {
      if (key.startsWith("header:")) picked[key] = resolveHeaderProperty(row, key);
      else if (key in full) picked[key] = full[key];
    }
    return picked;
  });
  return { accountId: ctx.accountId, state: await getEmailState(ctx), list, notFound: ids.filter((id) => !found.has(id)) };
};
var emailQuery = async (ctx, args) => {
  const { ids: accessibleIds, condition } = await scope(ctx);
  const filter = filterToSql(args.filter, new Set(accessibleIds));
  const where = filter ? and11(condition, filter) : condition;
  const order = sortToSql(args.sort);
  const collapse = !!args.collapseThreads;
  const limit = Math.min(Math.max(Number(args.limit ?? LIMITS.maxQueryLimit), 0), LIMITS.maxQueryLimit);
  let position = Number(args.position ?? 0);
  const threadKey = sql5`coalesce(${messages.threadId}, ${messages.id})`;
  const allRows = await ctx.db.select({ id: messages.id, thread: threadKey }).from(messages).where(where).orderBy(...order).limit(1e4);
  let ordered = allRows.map((row) => row.id);
  if (collapse) {
    const seen = /* @__PURE__ */ new Set();
    ordered = allRows.filter((row) => seen.has(row.thread) ? false : (seen.add(row.thread), true)).map((row) => row.id);
  }
  if (args.anchor) {
    const index = ordered.indexOf(String(args.anchor));
    if (index < 0) return { type: "anchorNotFound" };
    position = index + Number(args.anchorOffset ?? 0);
  }
  if (position < 0) position = Math.max(ordered.length + position, 0);
  const page = ordered.slice(position, position + limit);
  return {
    accountId: ctx.accountId,
    queryState: await getEmailState(ctx),
    canCalculateChanges: false,
    position,
    ids: page,
    ...args.calculateTotal ? { total: ordered.length } : {}
  };
};
var emailChanges = async (ctx, args) => emailChangesSince(ctx, args);
var emailQueryChanges = async () => {
  return { type: "cannotCalculateChanges" };
};
function unescapeJsonPointer(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}
function targetFromMailboxIds(row, patch, accessible) {
  let ids = null;
  if (patch.mailboxIds && typeof patch.mailboxIds === "object") {
    ids = Object.entries(patch.mailboxIds).filter(([, on]) => on).map(([id]) => id);
  } else {
    const current = new Set(Object.keys(buildEmailObject(row, [], { fetchBodies: false, maxBodyValueBytes: 0 }).mailboxIds));
    let touched = false;
    for (const [key, value] of Object.entries(patch)) {
      if (!key.startsWith("mailboxIds/")) continue;
      touched = true;
      const id = unescapeJsonPointer(key.slice("mailboxIds/".length));
      if (value) current.add(id);
      else current.delete(id);
    }
    if (touched) ids = Array.from(current);
  }
  if (!ids) return null;
  if (ids.length !== 1) return { error: { type: "invalidProperties", properties: ["mailboxIds"], description: "A message belongs to exactly one mailbox" } };
  const ref = decodeMailboxRef(ids[0]);
  if (!ref || !accessible.has(ref.mailboxId)) return { error: { type: "invalidProperties", properties: ["mailboxIds"], description: "Unknown mailbox" } };
  if (ref.mailboxId !== row.mailboxId) return { error: { type: "invalidProperties", properties: ["mailboxIds"], description: "Messages cannot move between accounts' mailboxes" } };
  if (ref.kind === "account") return { error: { type: "invalidProperties", properties: ["mailboxIds"], description: "Choose a folder or system mailbox" } };
  if (ref.kind === "folder") return { status: row.direction === "outbound" && row.status !== "draft" ? "sent" : "received", folderId: ref.folderId };
  if (ref.role === "sent" && row.direction === "inbound") return { error: { type: "invalidProperties", properties: ["mailboxIds"], description: "Received mail cannot be moved to Sent" } };
  return { status: roleToStatus(ref.role), folderId: null };
}
function keywordsFromPatch(patch) {
  const result = {};
  const apply = (keyword, value) => {
    if (keyword === KEYWORD_SEEN) result.read = !!value;
    if (keyword === KEYWORD_FLAGGED) result.starred = !!value;
  };
  if (patch.keywords && typeof patch.keywords === "object") {
    const map = patch.keywords;
    result.read = !!map[KEYWORD_SEEN];
    result.starred = !!map[KEYWORD_FLAGGED];
  }
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith("keywords/")) apply(unescapeJsonPointer(key.slice("keywords/".length)), value);
  }
  return result;
}
async function createDraft(ctx, value, accessible) {
  const target = resolveDraftsMailbox(value.mailboxIds, accessible);
  if ("error" in target) return target;
  const from = value.from?.[0]?.email;
  if (!from) return { error: { type: "invalidProperties", properties: ["from"] } };
  let sender;
  try {
    sender = await getAuthorizedSenderAddress(ctx.env, { userId: ctx.auth.userId, from, mailboxId: target.mailboxId });
  } catch (error) {
    return { error: { type: "forbidden", description: error instanceof Error ? error.message : "Cannot send from that address" } };
  }
  const addressList = (list) => Array.isArray(list) ? joinEmailAddressList(list.map((item) => item.name ? `"${item.name.replace(/"/g, '\\"')}" <${item.email}>` : item.email)) : "";
  const bodyValues = value.bodyValues ?? {};
  const partText = (parts) => Array.isArray(parts) && parts[0]?.partId ? bodyValues[parts[0].partId]?.value ?? "" : "";
  const text = partText(value.textBody);
  const html = partText(value.htmlBody);
  const references = Array.isArray(value.references) ? value.references.join(" ") : null;
  const id = await insertDraft(ctx, {
    mailboxId: sender.mailboxId,
    fromAddr: sender.fromAddr,
    toAddr: addressList(value.to),
    ccAddr: addressList(value.cc) || null,
    bccAddr: addressList(value.bcc) || null,
    subject: typeof value.subject === "string" ? value.subject : null,
    textBody: text || null,
    htmlBody: html || null,
    inReplyTo: Array.isArray(value.inReplyTo) ? value.inReplyTo[0] ?? null : null,
    references
  });
  const uploads = [];
  for (const part of value.attachments ?? []) {
    const blob = part.blobId ? decodeBlobId(part.blobId) : null;
    if (!blob || blob.kind !== "up") continue;
    const upload = await readUpload(ctx, blob.id);
    if (!upload) continue;
    uploads.push({ filename: part.name ?? upload.name ?? "attachment", type: part.type ?? upload.type, content: upload.content, disposition: part.disposition === "inline" ? "inline" : "attachment", contentId: part.cid ?? null });
  }
  if (uploads.length) {
    try {
      await storeMessageAttachments(ctx.env, id, uploads);
    } catch (error) {
      await ctx.db.delete(messages).where(eq13(messages.id, id));
      return { error: { type: "tooLarge", description: error instanceof Error ? error.message : "Attachments rejected" } };
    }
  }
  return { id };
}
var emailSet = async (ctx, args) => {
  const oldState = await getEmailState(ctx);
  if (args.ifInState && args.ifInState !== oldState) return { type: "stateMismatch" };
  const accessible = await listAccessibleMailboxIdSet(ctx);
  const writable = new Set((await listJmapMailboxes(ctx)).filter((row) => row.permission !== "read_only").map((row) => row.id));
  const created = {};
  const notCreated = {};
  const updated = {};
  const notUpdated = {};
  const destroyed = [];
  const notDestroyed = {};
  for (const [creationId, value] of Object.entries(args.create ?? {})) {
    const result = await createDraft(ctx, value, writable);
    if ("error" in result) {
      notCreated[creationId] = result.error;
      continue;
    }
    ctx.createdIds[creationId] = result.id;
    const [row] = await loadMessages(ctx, [result.id]);
    created[creationId] = row ? buildEmailObject(row, [], { fetchBodies: false, maxBodyValueBytes: 0 }) : { id: result.id };
  }
  const updates = Object.entries(args.update ?? {});
  const rows = await loadMessages(ctx, updates.map(([id]) => id));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, patch] of updates) {
    const row = byId.get(id);
    if (!row || !row.mailboxId) {
      notUpdated[id] = { type: "notFound" };
      continue;
    }
    if (!writable.has(row.mailboxId)) {
      notUpdated[id] = { type: "forbidden" };
      continue;
    }
    const move = targetFromMailboxIds(row, patch, accessible);
    if (move && "error" in move) {
      notUpdated[id] = move.error;
      continue;
    }
    const flags = keywordsFromPatch(patch);
    const set = {};
    if (flags.read !== void 0) set.read = flags.read;
    if (flags.starred !== void 0) set.starred = flags.starred;
    if (move) {
      if (move.status !== void 0) set.status = move.status;
      if (move.folderId !== void 0) set.folderId = move.folderId;
    }
    if (Object.keys(set).length) await ctx.db.update(messages).set(set).where(eq13(messages.id, id));
    updated[id] = null;
  }
  const destroyIds = args.destroy ?? [];
  const destroyRows = await loadMessages(ctx, destroyIds);
  const destroyById = new Map(destroyRows.map((row) => [row.id, row]));
  for (const id of destroyIds) {
    const row = destroyById.get(id);
    if (!row || !row.mailboxId) {
      notDestroyed[id] = { type: "notFound" };
      continue;
    }
    if (!writable.has(row.mailboxId)) {
      notDestroyed[id] = { type: "forbidden" };
      continue;
    }
    if (row.status === "trash" || row.status === "draft") await deleteMessageWithObjects(ctx.env, ctx.db, row.id, row.rawR2Key);
    else await ctx.db.update(messages).set({ status: "trash", folderId: null }).where(eq13(messages.id, id));
    destroyed.push(id);
  }
  return { accountId: ctx.accountId, oldState, newState: await getEmailState(ctx), created, updated, destroyed, notCreated, notUpdated, notDestroyed };
};
async function importEmail(ctx, value, writable) {
  const target = resolveDraftsMailbox(value.mailboxIds, writable);
  if ("error" in target) return target;
  const blob = typeof value.blobId === "string" ? decodeBlobId(value.blobId) : null;
  if (!blob || blob.kind !== "up") return { error: { type: "blobNotFound", description: "blobId must name an upload from this account" } };
  const upload = await readUpload(ctx, blob.id);
  if (!upload) return { error: { type: "blobNotFound", description: "No such upload" } };
  if (upload.content.byteLength === 0) return { error: { type: "invalidEmail", description: "The blob is empty" } };
  if (upload.content.byteLength > LIMITS.maxSizeUpload) return { error: { type: "tooLarge", description: "The message exceeds maxSizeUpload" } };
  let parsed;
  try {
    parsed = await parseRawMime(upload.content);
  } catch (error) {
    return { error: { type: "invalidEmail", description: error instanceof Error ? error.message : "The blob is not a MIME message" } };
  }
  if (!parsed.fromAddr) return { error: { type: "invalidEmail", description: "The message has no From header" } };
  let sender;
  try {
    sender = await getAuthorizedSenderAddress(ctx.env, { userId: ctx.auth.userId, from: parsed.fromAddr, mailboxId: target.mailboxId });
  } catch (error) {
    return { error: { type: "forbidden", description: error instanceof Error ? error.message : "Cannot send from that address" } };
  }
  const flags = importFlags(value.keywords);
  const id = await insertDraft(ctx, {
    mailboxId: sender.mailboxId,
    fromAddr: sender.fromAddr,
    toAddr: parsed.toAddr ?? "",
    ccAddr: parsed.ccAddr,
    bccAddr: parsed.bccAddr,
    subject: parsed.subject,
    textBody: parsed.text,
    htmlBody: parsed.html,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references.length ? parsed.references.join(" ") : null,
    read: flags.read,
    starred: flags.starred,
    // Angle brackets are kept, as inbound rows store them.
    providerMessageId: parsed.messageId,
    threadId: await resolveThreadId(ctx.db, {
      mailboxId: sender.mailboxId,
      messageId: parsed.messageId,
      inReplyTo: parsed.inReplyTo,
      references: parsed.references
    }),
    createdAt: parseReceivedAt(value.receivedAt) ?? parsed.date ?? /* @__PURE__ */ new Date()
  });
  let rawR2Key = null;
  try {
    rawR2Key = await storeRawDraftMime(ctx, id, upload.content);
    await ctx.db.update(messages).set({ rawR2Key }).where(eq13(messages.id, id));
    if (parsed.attachments.length) await storeMessageAttachments(ctx.env, id, parsed.attachments);
  } catch (error) {
    try {
      await deleteMessageWithObjects(ctx.env, ctx.db, id, rawR2Key);
    } catch (cleanupError) {
      console.error(`Failed to clean up rejected Email/import draft ${id}`, cleanupError);
    }
    return { error: { type: "tooLarge", description: error instanceof Error ? error.message : "Attachments rejected" } };
  }
  try {
    await deleteUpload(ctx, blob.id);
  } catch (error) {
    console.warn(`Failed to delete claimed JMAP upload ${blob.id}`, error);
  }
  return { id };
}
var emailImport = async (ctx, args) => {
  const oldState = await getEmailState(ctx);
  if (args.ifInState && args.ifInState !== oldState) return { type: "stateMismatch" };
  const emails = args.emails ?? {};
  if (Object.keys(emails).length > LIMITS.maxObjectsInSet) throw new JmapError("requestTooLarge");
  const writable = new Set((await listJmapMailboxes(ctx)).filter((row) => row.permission !== "read_only").map((row) => row.id));
  const created = {};
  const notCreated = {};
  for (const [creationId, value] of Object.entries(emails)) {
    const result = await importEmail(ctx, value ?? {}, writable);
    if ("error" in result) {
      notCreated[creationId] = result.error;
      continue;
    }
    ctx.createdIds[creationId] = result.id;
    const [row] = await loadMessages(ctx, [result.id]);
    if (!row) {
      notCreated[creationId] = { type: "serverFail", description: "The imported message could not be read back" };
      continue;
    }
    const object = buildEmailObject(row, (await loadAttachmentsByMessage(ctx, [row.id])).get(row.id) ?? [], { fetchBodies: false, maxBodyValueBytes: 0 });
    created[creationId] = { id: object.id, blobId: object.blobId, threadId: object.threadId, size: object.size };
  }
  return { accountId: ctx.accountId, oldState, newState: await getEmailState(ctx), created, notCreated };
};
var emailUnsupported = (method) => async () => ({ type: "unknownMethod", description: `${method} is not supported` });
var threadGet = async (ctx, args) => {
  const ids = args.ids;
  if (!ids) throw new JmapError("requestTooLarge", "Thread/get needs an explicit list of ids");
  const { ids: accessible, condition } = await scope(ctx);
  const threadKey = sql5`coalesce(${messages.threadId}, ${messages.id})`;
  const batch = Math.max(1, 100 - accessible.length);
  const unique = [...new Set(ids)];
  const rows = [];
  for (let offset = 0; offset < unique.length; offset += batch) {
    rows.push(
      ...await ctx.db.select({ id: messages.id, thread: threadKey }).from(messages).where(and11(condition, inArray7(threadKey, unique.slice(offset, offset + batch)))).orderBy(asc4(messages.createdAt))
    );
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) grouped.set(row.thread, [...grouped.get(row.thread) ?? [], row.id]);
  return {
    accountId: ctx.accountId,
    state: await getEmailState(ctx),
    list: Array.from(grouped, ([id, emailIds]) => ({ id, emailIds })),
    notFound: ids.filter((id) => !grouped.has(id))
  };
};
var threadChanges = async (ctx, args) => threadChangesSince(ctx, args);
var searchSnippetGet = async (ctx, args) => {
  const ids = args.emailIds ?? [];
  const filter = args.filter ?? {};
  const term = (filter.text ?? filter.body ?? filter.subject ?? "").trim();
  const rows = await loadMessages(ctx, ids);
  const found = /* @__PURE__ */ new Set();
  const escape = (value) => value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
  const highlight = (value) => {
    if (!value) return null;
    if (!term) return escape(value);
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
    return escape(value).replace(re, (match) => `<mark>${match}</mark>`);
  };
  const list = rows.map((row) => {
    found.add(row.id);
    const body = row.textBody ?? row.snippet ?? "";
    let excerpt = null;
    if (term) {
      const index = body.toLowerCase().indexOf(term.toLowerCase());
      if (index >= 0) excerpt = highlight(body.slice(Math.max(index - 80, 0), index + 160));
    }
    return { emailId: row.id, subject: highlight(row.subject), preview: excerpt };
  });
  return { accountId: ctx.accountId, list, notFound: ids.filter((id) => !found.has(id)) };
};

// src/lib/jmap/identities.ts
import { and as and16, eq as eq24 } from "drizzle-orm";

// src/lib/email/send.ts
import { and as and15, eq as eq23 } from "drizzle-orm";

// src/lib/email/webhooks.ts
import { eq as eq14 } from "drizzle-orm";
var REQUEST_TIMEOUT_MS = 1e4;
var MAX_RESPONSE_SNIPPET = 500;
function getRetryDelaySeconds(attempt) {
  return Math.min(60 * 2 ** Math.max(attempt - 1, 0), 3600);
}
function parseWebhookEvents(events) {
  try {
    const parsed = JSON.parse(events);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}
async function dispatchWebhooks(env2, userId, eventType, payload) {
  const db = getDb(env2);
  const hooks = await db.select().from(webhooks).where(eq14(webhooks.userId, userId));
  for (const hook of hooks) {
    if (!hook.enabled) continue;
    if (!parseWebhookEvents(hook.events).includes(eventType)) continue;
    try {
      const body = JSON.stringify({ type: eventType, data: payload });
      const delivery = await createDelivery(db, hook.id, eventType, body);
      await attemptDelivery(env2, db, hook, delivery);
    } catch (error) {
      console.error(`Webhook dispatch failed for ${hook.id}`, error);
    }
  }
}
async function createDelivery(db, webhookId, eventType, payload) {
  const id = newId("whd");
  await db.insert(webhookDeliveries).values({
    id,
    webhookId,
    eventType,
    payload,
    status: "pending",
    attempts: 0
  });
  return { id, payload, eventType, attempts: 0 };
}
async function attemptDelivery(env2, db, hook, delivery) {
  const attempts = delivery.attempts + 1;
  const startedAt = Date.now();
  const now = /* @__PURE__ */ new Date();
  let responseStatus = null;
  let error = null;
  try {
    const signature = await signPayload(hook.secret, delivery.payload);
    const res = await fetch(hook.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Email-Platform-Signature": signature,
        "X-Email-Platform-Event": delivery.eventType,
        "X-Email-Platform-Delivery": delivery.id,
        "X-Email-Platform-Attempt": String(attempts)
      },
      body: delivery.payload
    });
    responseStatus = res.status;
    if (!res.ok) {
      error = await readResponseSnippet(res) || `Endpoint responded with ${res.status}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Request failed";
  }
  const durationMs = Date.now() - startedAt;
  const delivered = !error;
  const canRetry = !delivered && attempts < hook.maxAttempts;
  const status = delivered ? "delivered" : canRetry ? "retrying" : "exhausted";
  const nextRetryAt = canRetry ? new Date(Date.now() + getRetryDelaySeconds(attempts) * 1e3) : null;
  await db.update(webhookDeliveries).set({
    status,
    attempts,
    responseStatus,
    error: error ? error.slice(0, MAX_RESPONSE_SNIPPET) : null,
    durationMs,
    lastAttemptAt: now,
    nextRetryAt
  }).where(eq14(webhookDeliveries.id, delivery.id));
  if (canRetry) {
    await scheduleRetry(env2, delivery.id, getRetryDelaySeconds(attempts));
  }
  return status;
}
async function scheduleRetry(env2, deliveryId, delaySeconds) {
  const message = { kind: "webhook.retry", deliveryId };
  try {
    await env2.OUTBOUND_QUEUE.send(message, { delaySeconds });
  } catch (error) {
    console.error(`Failed to schedule webhook retry for ${deliveryId}`, error);
  }
}
async function readResponseSnippet(res) {
  try {
    const text = await res.text();
    return text.trim().slice(0, MAX_RESPONSE_SNIPPET);
  } catch {
    return "";
  }
}
async function signPayload(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/lib/contacts/service.ts
import { and as and12, eq as eq15, inArray as inArray8 } from "drizzle-orm";

// src/lib/contacts/utils.ts
function getContactId(userId, email) {
  return `${userId}:${email.trim().toLowerCase()}`;
}
function getContactNameFromAddress(address) {
  const name = parseEmailAddressParts(address).name?.trim();
  if (!name) return null;
  return name === normalizeEmailAddress(address) ? null : name;
}

// src/lib/contacts/avatar.ts
function contactAvatarKeyFor(userId, email) {
  return `contact-avatars/${userId}/${encodeURIComponent(email.trim().toLowerCase())}`;
}

// src/lib/avatar-images.ts
var MAX_STORED_AVATAR_SIZE = 1024 * 1024;
var MAX_PREVIEW_AVATAR_SIZE = 32 * 1024;
function avatarPreviewKeyFor(key) {
  return `${key}:preview`;
}

// src/lib/contacts/gravatar.ts
var MAX_GRAVATAR_SIZE = 2 * 1024 * 1024;
var ALLOWED_GRAVATAR_TYPES = /* @__PURE__ */ new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
async function importGravatarAvatar(env2, userId, email) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalizedEmail)
    );
    const hash = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");
    const response = await fetch(
      `https://gravatar.com/avatar/${hash}?d=404&r=g&s=256`
    );
    if (!response.ok) return null;
    const contentType = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
    const declaredSize = Number(response.headers.get("Content-Length") ?? 0);
    if (!contentType || !ALLOWED_GRAVATAR_TYPES.has(contentType)) return null;
    if (declaredSize > MAX_GRAVATAR_SIZE) return null;
    const image = await response.arrayBuffer();
    if (image.byteLength > MAX_GRAVATAR_SIZE) return null;
    const key = contactAvatarKeyFor(userId, normalizedEmail);
    await env2.BUCKET.put(key, image, { httpMetadata: { contentType } });
    try {
      const previewResponse = await fetch(`https://gravatar.com/avatar/${hash}?d=404&r=g&s=16`);
      if (previewResponse.ok) {
        const previewType = previewResponse.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
        const preview = await previewResponse.arrayBuffer();
        if (previewType && ALLOWED_GRAVATAR_TYPES.has(previewType) && preview.byteLength <= 32 * 1024) {
          await env2.BUCKET.put(avatarPreviewKeyFor(key), preview, { httpMetadata: { contentType: previewType } });
        }
      }
    } catch {
    }
    return key;
  } catch {
    return null;
  }
}

// src/lib/contacts/service.ts
async function upsertContactFromAddress(env2, input) {
  const email = normalizeEmailAddress(input.address);
  if (!email) return null;
  const displayName = getContactNameFromAddress(input.address);
  const db = getDb(env2);
  const [existing] = await db.select().from(contacts).where(and12(eq15(contacts.userId, input.userId), eq15(contacts.email, email))).limit(1);
  const now = /* @__PURE__ */ new Date();
  if (existing) {
    const nextDisplayName = getNextDisplayName(existing.displayName, existing.source, displayName);
    const nextSource = existing.source === "manual" || existing.source === "outbound" && input.source === "inbound" ? existing.source : input.source;
    await db.update(contacts).set({
      displayName: nextDisplayName,
      source: nextSource,
      lastSeenAt: now
    }).where(eq15(contacts.id, existing.id));
    return { ...existing, displayName: nextDisplayName, source: nextSource, lastSeenAt: now };
  }
  const id = getContactId(input.userId, email);
  await db.insert(contacts).values({
    id,
    userId: input.userId,
    email,
    displayName,
    source: input.source,
    lastSeenAt: now
  }).onConflictDoNothing();
  const avatarKey = await importGravatarAvatar(env2, input.userId, email);
  if (avatarKey) {
    await db.update(contacts).set({ avatarKey }).where(eq15(contacts.id, id));
  }
  const [created] = await db.select().from(contacts).where(eq15(contacts.id, id)).limit(1);
  return created ?? null;
}
function getNextDisplayName(existingName, source, nextName) {
  if (source === "manual") return existingName;
  if (nextName) return nextName;
  return existingName;
}

// src/lib/mailboxes/audit.ts
async function createAuditLog(env2, input) {
  const db = getDb(env2);
  await db.insert(auditLogs).values({
    id: newId("aud"),
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId ?? null,
    mailboxId: input.mailboxId ?? null,
    messageId: input.messageId ?? null,
    action: input.action,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null
  });
}

// src/lib/email/attachment-policy.ts
import { eq as eq16 } from "drizzle-orm";
var DEFAULT_OUTBOUND_ATTACHMENT_MAX_MB = 25;
var CLOUD_ATTACHMENT_THRESHOLD_BYTES = 3e6;
async function getOutboundAttachmentMaxMb(env2) {
  const [settings] = await getDb(env2).select({ maxMb: appSettings.outboundAttachmentMaxMb }).from(appSettings).where(eq16(appSettings.id, "default")).limit(1);
  return settings?.maxMb ?? DEFAULT_OUTBOUND_ATTACHMENT_MAX_MB;
}

// src/lib/email/outbound-provider.ts
import { eq as eq18 } from "drizzle-orm";

// src/lib/aws/config.ts
import { eq as eq17 } from "drizzle-orm";
async function readStored(env2) {
  const [row] = await getDb(env2).select({ awsConfig: appSettings.awsConfig }).from(appSettings).where(eq17(appSettings.id, "default")).limit(1);
  if (!row?.awsConfig) return null;
  try {
    return JSON.parse(row.awsConfig);
  } catch {
    return null;
  }
}
async function getAwsConfig(env2) {
  const stored = await readStored(env2);
  if (stored?.accessKeyId && stored.secretAccessKey && stored.region) {
    return { accessKeyId: stored.accessKeyId, secretAccessKey: stored.secretAccessKey, region: stored.region };
  }
  const vars = env2;
  const accessKeyId = vars.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = vars.AWS_SECRET_ACCESS_KEY?.trim();
  const region = (vars.AWS_REGION ?? vars.AWS_DEFAULT_REGION)?.trim();
  return accessKeyId && secretAccessKey && region ? { accessKeyId, secretAccessKey, region } : null;
}
async function requireAwsConfig(env2) {
  const config = await getAwsConfig(env2);
  if (!config) throw new Error("AWS is selected but no credentials are configured");
  return config;
}

// src/lib/aws/ses.ts
var sesV2 = (config, path) => ({ config, service: "ses", host: `email.${config.region}.amazonaws.com`, path });
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
async function sendSesEmail(config, input) {
  const headers = Object.entries(input.headers ?? {}).filter(([name]) => name.toLowerCase() !== "message-id").map(([Name, Value]) => ({ Name, Value }));
  const result = await awsJson({
    ...sesV2(config, "/v2/email/outbound-emails"),
    method: "POST",
    json: {
      FromEmailAddress: input.from,
      Destination: { ToAddresses: input.to, ...input.cc?.length ? { CcAddresses: input.cc } : {}, ...input.bcc?.length ? { BccAddresses: input.bcc } : {} },
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Body: {
            ...input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {},
            ...input.html ? { Html: { Data: input.html, Charset: "UTF-8" } } : {}
          },
          ...headers.length ? { Headers: headers } : {},
          ...input.attachments?.length ? {
            Attachments: input.attachments.map((attachment) => ({
              RawContent: toBase64(attachment.content),
              FileName: attachment.filename,
              ContentType: attachment.type,
              ContentDisposition: attachment.disposition === "inline" ? "INLINE" : "ATTACHMENT",
              ...attachment.disposition === "inline" && attachment.contentId ? { ContentId: attachment.contentId } : {},
              ContentTransferEncoding: "BASE64"
            }))
          } : {}
        }
      }
    }
  });
  const domain = config.region === "us-east-1" ? "email.amazonses.com" : `${config.region}.amazonses.com`;
  return { messageId: `<${result.MessageId}@${domain}>` };
}

// src/lib/email/outbound-provider.ts
var RESEND_ENDPOINT = "https://api.resend.com/emails";
async function getResendKeyStatus(env2) {
  const [settings] = await getDb(env2).select({ resendApiKey: appSettings.resendApiKey }).from(appSettings).where(eq18(appSettings.id, "default")).limit(1);
  const saved = settings?.resendApiKey?.trim();
  const fromEnv = env2.RESEND_API_KEY?.trim();
  return {
    configured: !!(saved || fromEnv),
    source: saved ? "settings" : fromEnv ? "environment" : null,
    apiKey: saved || fromEnv || null
  };
}
async function getResendApiKey(env2) {
  const { apiKey } = await getResendKeyStatus(env2);
  if (!apiKey) throw new Error("Resend is selected but no API key is configured");
  return apiKey;
}
async function getOutboundProviderConfig(env2, fromAddress) {
  const hostname = getEmailAddress(fromAddress).split("@")[1]?.toLowerCase();
  const [domain] = hostname ? await getDb(env2).select({ provider: domains.sendingProvider }).from(domains).where(eq18(domains.hostname, hostname)).limit(1) : [];
  if (!domain || domain.provider === "none") {
    throw new Error(`Sending is not set up for ${hostname ?? "this domain"}. Choose a sending provider on the Domains page.`);
  }
  if (domain.provider === "resend") return { provider: "resend", apiKey: await getResendApiKey(env2) };
  if (domain.provider === "ses") return { provider: "ses", config: await requireAwsConfig(env2) };
  return { provider: "cloudflare" };
}
function toBase642(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}
function mintMessageId(from) {
  const domain = getEmailAddress(from).split("@")[1] || "cmail.local";
  return `<${crypto.randomUUID()}@${domain}>`;
}
async function sendWithResend(apiKey, message, idempotencyKey) {
  const messageId = message.headers?.["Message-ID"] ?? mintMessageId(message.from);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      ...message.cc?.length ? { cc: message.cc } : {},
      ...message.bcc?.length ? { bcc: message.bcc } : {},
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: { ...message.headers, "Message-ID": messageId },
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: toBase642(attachment.content),
        content_type: attachment.type,
        ...attachment.disposition === "inline" && attachment.contentId ? { content_id: attachment.contentId } : {}
      }))
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`Resend: ${body?.message ?? `request failed (${response.status})`}`);
  }
  return { messageId };
}
async function sendThroughProvider(env2, config, message, idempotencyKey) {
  if (config.provider === "resend") return sendWithResend(config.apiKey, message, idempotencyKey);
  if (config.provider === "ses") return sendSesEmail(config.config, message);
  const response = await env2.EMAIL.send({
    from: message.from,
    to: message.to,
    ...message.cc?.length ? { cc: message.cc } : {},
    ...message.bcc?.length ? { bcc: message.bcc } : {},
    subject: message.subject,
    headers: message.headers && Object.keys(message.headers).length ? message.headers : void 0,
    html: message.html,
    text: message.text,
    attachments: message.attachments?.map(
      (attachment) => attachment.disposition === "inline" && attachment.contentId ? { filename: attachment.filename, type: attachment.type, content: attachment.content, disposition: "inline", contentId: attachment.contentId } : { filename: attachment.filename, type: attachment.type, content: attachment.content, disposition: "attachment" }
    )
  });
  return { messageId: response.messageId };
}

// src/lib/email/shared-attachments.ts
import { and as and13, eq as eq19, lte } from "drizzle-orm";
var SHARED_ATTACHMENT_LINK_DAYS = 30;
async function getOrCreateSharedAttachmentUrl(env2, attachmentId, publicOrigin) {
  const origin = env2.APP_URL?.trim() || publicOrigin;
  if (!origin) throw new Error("Set APP_URL before sending large attachments as download links");
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("A public HTTPS APP_URL is required for large attachment links");
  }
  const db = getDb(env2);
  const now = /* @__PURE__ */ new Date();
  await db.delete(sharedAttachmentLinks).where(and13(eq19(sharedAttachmentLinks.attachmentId, attachmentId), lte(sharedAttachmentLinks.expiresAt, now)));
  const id = newId("share");
  await db.insert(sharedAttachmentLinks).values({
    id,
    attachmentId,
    expiresAt: new Date(now.getTime() + SHARED_ATTACHMENT_LINK_DAYS * 24 * 60 * 6e4)
  }).onConflictDoNothing();
  const [link] = await db.select({ id: sharedAttachmentLinks.id }).from(sharedAttachmentLinks).where(eq19(sharedAttachmentLinks.attachmentId, attachmentId)).limit(1);
  if (!link) throw new Error("Could not create a large attachment link");
  return new URL(`/api/shared-files/${encodeURIComponent(link.id)}`, url).toString();
}

// src/lib/email/cloud-attachment-utils.ts
var GENERAL_MESSAGE_LIMIT_BYTES = 5 * 1024 * 1024;
var MIME_SAFETY_MARGIN_BYTES = 256 * 1024;
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
async function prepareCloudflareAttachments(env2, attachments, message) {
  const encoder2 = new TextEncoder();
  let estimatedSize = encoder2.encode(message.subject + (message.html ?? "") + (message.text ?? "") + JSON.stringify(message.headers)).byteLength + 8192;
  const direct = [];
  const linked = [];
  for (const attachment of attachments) {
    const size = attachment.content.byteLength;
    const encodedSize = Math.ceil(size / 3) * 4 + 2048;
    if (size <= CLOUD_ATTACHMENT_THRESHOLD_BYTES && estimatedSize + encodedSize <= GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) {
      direct.push(attachment);
      estimatedSize += encodedSize;
      continue;
    }
    if (!attachment.storageId) throw new Error("Large attachment was not stored in object storage");
    linked.push({ filename: attachment.filename, size, url: await getOrCreateSharedAttachmentUrl(env2, attachment.storageId, message.publicOrigin) });
  }
  if (!linked.length) {
    if (estimatedSize > GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) throw new Error("Message exceeds Cloudflare's 5 MiB email size limit");
    return { attachments: direct, html: message.html, text: message.text };
  }
  const intro = "Files shared through Cmail (download links expire after 30 days):";
  const textLinks = linked.map((file) => `${file.filename} (${(file.size / 1e6).toFixed(1)} MB): ${file.url}`).join("\n");
  const htmlLinks = linked.map((file) => `<li>${escapeHtml(file.filename)} (${(file.size / 1e6).toFixed(1)} MB): <a href="${escapeHtml(file.url)}">Download file</a></li>`).join("");
  const text = [message.text?.trim(), intro, textLinks].filter(Boolean).join("\n\n");
  const html = `${message.html ?? ""}<div><p>${escapeHtml(intro)}</p><ul>${htmlLinks}</ul></div>`;
  if (estimatedSize + encoder2.encode(textLinks + htmlLinks + intro + intro).byteLength + 4096 > GENERAL_MESSAGE_LIMIT_BYTES - MIME_SAFETY_MARGIN_BYTES) {
    throw new Error("Message exceeds Cloudflare's 5 MiB email size limit even with download links");
  }
  return { attachments: direct, html, text };
}

// src/lib/tracking/open-tracking.ts
import { desc as desc3, eq as eq20, inArray as inArray9, sql as sql6 } from "drizzle-orm";

// src/lib/tracking/open-tracking-utils.ts
var TRACKING_PIXEL_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (char) => char.charCodeAt(0));
function createTrackingToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function buildTrackingPixelUrl(origin, token) {
  return `${origin.replace(/\/+$/, "")}/api/i/${token}.gif`;
}
function resolveTrackingOrigin(appUrl, publicOrigin) {
  for (const candidate of [appUrl?.trim(), publicOrigin?.trim()]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
    }
  }
  return null;
}
function injectTrackingPixel(html, pixelUrl) {
  const escaped = pixelUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const img = `<img src="${escaped}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;opacity:0" />`;
  const bodyClose = html.search(/<\/body\s*>/i);
  return bodyClose === -1 ? `${html}${img}` : `${html.slice(0, bodyClose)}${img}${html.slice(bodyClose)}`;
}

// src/lib/database-errors.ts
function errorChainMatches(error, pattern) {
  let current = error;
  const visited = /* @__PURE__ */ new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (pattern.test(current instanceof Error ? current.message : String(current))) return true;
    if (typeof current !== "object" || !("cause" in current)) break;
    current = current.cause;
  }
  return false;
}
function isMissingTableError(error) {
  return errorChainMatches(error, /no such table|relation "[^"]+" does not exist|table '[^']+' doesn't exist/i);
}
function isMissingColumnError(error) {
  return errorChainMatches(error, /no such column|has no column named|column "[^"]+" (of relation "[^"]+" )?does not exist|unknown column/i);
}

// src/lib/tracking/open-tracking.ts
async function ensureTrackingToken(env2, messageId) {
  const db = getDb(env2);
  await db.insert(messageTracking).values({ token: createTrackingToken(), messageId }).onConflictDoNothing();
  const [row] = await db.select({ token: messageTracking.token }).from(messageTracking).where(eq20(messageTracking.messageId, messageId)).limit(1);
  if (!row) throw new Error("Could not create the read-receipt token");
  return row.token;
}
async function getTrackingHostForSender(env2, from) {
  const domain = getEmailAddress(from).split("@")[1]?.toLowerCase();
  if (!domain) return null;
  try {
    const [row] = await getDb(env2).select({ hostname: domainTrackingHosts.hostname }).from(domainTrackingHosts).innerJoin(domains, eq20(domains.id, domainTrackingHosts.domainId)).where(eq20(domains.hostname, domain)).limit(1);
    return row?.hostname ?? null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

// src/lib/follow-ups/service.ts
import { and as and14, desc as desc4, eq as eq21, inArray as inArray10, lte as lte2, sql as sql7 } from "drizzle-orm";

// src/lib/follow-ups/follow-up-utils.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function followUpDueAt(from, days) {
  return new Date(from.getTime() + days * DAY_MS);
}

// src/lib/follow-ups/service.ts
var hasReply = sql7`exists (
	select 1 from messages reply
	where reply.thread_id = ${messages.threadId}
		and reply.mailbox_id = ${messages.mailboxId}
		and reply.direction = 'inbound'
		and reply.created_at > ${messages.createdAt}
)`;
async function setFollowUp(env2, input) {
  const dueAt = followUpDueAt(input.from ?? /* @__PURE__ */ new Date(), input.days);
  const [row] = await getDb(env2).insert(followUps).values({ id: newId("fup"), messageId: input.messageId, userId: input.userId, dueAt }).onConflictDoUpdate({ target: followUps.messageId, set: { dueAt, status: "pending", userId: input.userId } }).returning({ id: followUps.id, status: followUps.status, dueAt: followUps.dueAt });
  return { id: row.id, status: row.status, dueAt: row.dueAt.toISOString() };
}

// src/lib/compose/preferences.ts
import { eq as eq22, sql as sql8 } from "drizzle-orm";

// src/lib/compose/compose-utils.ts
var UNDO_SEND_OPTIONS = [0, 5, 10, 15, 30];
var DEFAULT_UNDO_SEND_SECONDS = 15;
function parseUndoSendSeconds(value) {
  const seconds = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof seconds === "number" && UNDO_SEND_OPTIONS.includes(seconds) ? seconds : null;
}

// src/lib/compose/preferences.ts
var DEFAULTS = { trackOpensDefault: false, undoSendSeconds: DEFAULT_UNDO_SEND_SECONDS };
async function getComposePreferences(env2, userId) {
  const db = getDb(env2);
  try {
    const [row2] = await db.select({ trackOpensDefault: userComposePreferences.trackOpensDefault, undoSendSeconds: userComposePreferences.undoSendSeconds }).from(userComposePreferences).where(eq22(userComposePreferences.userId, userId)).limit(1);
    if (!row2) return DEFAULTS;
    return { trackOpensDefault: row2.trackOpensDefault, undoSendSeconds: parseUndoSendSeconds(row2.undoSendSeconds) ?? DEFAULT_UNDO_SEND_SECONDS };
  } catch (error) {
    if (isMissingTableError(error)) return DEFAULTS;
    if (!isMissingColumnError(error)) throw error;
  }
  const [row] = await db.select({ trackOpensDefault: userComposePreferences.trackOpensDefault }).from(userComposePreferences).where(eq22(userComposePreferences.userId, userId)).limit(1);
  return { ...DEFAULTS, trackOpensDefault: row?.trackOpensDefault ?? false };
}

// src/lib/email/send.ts
var MAX_RECIPIENTS = 50;
var MAX_QUEUE_DELAY_SECONDS = 24 * 60 * 60;
function toRecipientList(value) {
  const entries = Array.isArray(value) ? value : splitEmailAddressList(value);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const entry of entries) {
    const [address] = getEmailAddressList(entry);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    result.push(entry.trim());
  }
  return result;
}
async function sendEmail(env2, input) {
  const db = getDb(env2);
  const sender = await getAuthorizedSenderAddress(env2, input);
  const attachments = input.attachments ?? [];
  validateAttachments(attachments);
  const maxAttachmentMb = await getOutboundAttachmentMaxMb(env2);
  const maxAttachmentBytes = maxAttachmentMb * 1e6;
  if (attachments.some((attachment) => attachment.content.byteLength > maxAttachmentBytes) || attachments.reduce((total, attachment) => total + attachment.content.byteLength, 0) > maxAttachmentBytes) {
    throw new Error(`Attachments exceed the administrator's ${maxAttachmentMb} MB outgoing limit`);
  }
  if (input.subject.length > 998) throw new Error("Subject exceeds Cloudflare's 998-character limit");
  const to = toRecipientList(input.to);
  const cc = toRecipientList(input.cc);
  const bcc = toRecipientList(input.bcc);
  if (to.length === 0) throw new Error("At least one recipient is required");
  if (to.length + cc.length + bcc.length > MAX_RECIPIENTS) {
    throw new Error(`A message can have at most ${MAX_RECIPIENTS} recipients`);
  }
  for (const address of [...to, ...cc, ...bcc]) {
    await upsertContactFromAddress(env2, { userId: input.userId, address, source: "outbound" });
  }
  const inReplyTo = normalizeMessageId(input.inReplyTo);
  const references = Array.isArray(input.references) ? input.references.map((id) => normalizeMessageId(id)).filter((id) => !!id) : parseMessageIdList(input.references);
  const headers = { ...input.headers };
  if (inReplyTo) headers["In-Reply-To"] = `<${inReplyTo}>`;
  if (references.length > 0) headers.References = formatMessageIdHeader(references);
  if (new TextEncoder().encode(Object.entries(headers).map(([name, value]) => `${name}: ${value}\r
`).join("")).byteLength > 16 * 1024) {
    throw new Error("Headers exceed Cloudflare's 16 KB limit");
  }
  const messageId = newId("msg");
  const requestedSchedule = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const userScheduledAt = requestedSchedule && requestedSchedule.getTime() > Date.now() ? requestedSchedule : null;
  const undoSeconds = !userScheduledAt && input.undoSend ? (await getComposePreferences(env2, input.userId)).undoSendSeconds : 0;
  const scheduledAt = userScheduledAt ?? (undoSeconds > 0 ? new Date(Date.now() + undoSeconds * 1e3) : null);
  const snippet = buildSnippet(input.text ?? null, input.html ?? null);
  const toAddr = joinEmailAddressList(to);
  await db.insert(messages).values({
    id: messageId,
    userId: input.userId,
    mailboxId: sender.mailboxId,
    direction: "outbound",
    fromAddr: sender.fromAddr,
    toAddr,
    ccAddr: cc.length ? joinEmailAddressList(cc) : null,
    bccAddr: bcc.length ? joinEmailAddressList(bcc) : null,
    subject: input.subject,
    snippet,
    textBody: input.text ?? null,
    htmlBody: input.html ?? null,
    status: "queued",
    read: true,
    threadId: input.threadId ?? null,
    inReplyTo,
    references: references.length ? references.join(" ") : null
  });
  try {
    const stored = await storeMessageAttachments(env2, messageId, attachments);
    stored.forEach((attachment, index) => {
      attachments[index].storageId = attachment.id;
    });
  } catch (error) {
    await db.delete(messages).where(eq23(messages.id, messageId));
    throw error;
  }
  const jobId = newId("job");
  await db.insert(outboundJobs).values({
    id: jobId,
    userId: input.userId,
    messageId,
    status: "queued",
    payload: JSON.stringify({
      ...input,
      from: sender.fromAddr,
      to,
      cc,
      bcc,
      mailboxId: sender.mailboxId,
      attachments: attachments.map(({ content: _content, ...attachment }) => attachment)
    }),
    scheduledAt
  });
  const delivery = {
    input: { ...input, attachments: void 0 },
    messageId,
    jobId,
    from: sender.fromAddr,
    mailboxId: sender.mailboxId,
    to,
    cc,
    bcc,
    headers,
    attachments
  };
  if (scheduledAt) {
    await enqueueScheduledDelivery(env2, delivery, scheduledAt);
    return userScheduledAt ? { messageId, scheduled: true } : { messageId, scheduled: true, undoSeconds };
  }
  await deliverEmail(env2, delivery);
  return { messageId };
}
async function deliverEmail(env2, delivery) {
  const { input, messageId, jobId, from, mailboxId, to, cc, bcc, headers, attachments } = delivery;
  const db = getDb(env2);
  const toAddr = joinEmailAddressList(to);
  try {
    const provider = await getOutboundProviderConfig(env2, from);
    const prepared = provider.provider === "cloudflare" ? await prepareCloudflareAttachments(env2, attachments, {
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers,
      publicOrigin: input.publicOrigin
    }) : { attachments, html: input.html, text: input.text };
    if (prepared.text !== input.text || prepared.html !== input.html) {
      await db.update(messages).set({ textBody: prepared.text ?? null, htmlBody: prepared.html ?? null }).where(eq23(messages.id, messageId));
    }
    const html = input.trackOpens && prepared.html ? await withTrackingPixel(env2, messageId, from, prepared.html, input.publicOrigin) : prepared.html;
    const response = await sendThroughProvider(
      env2,
      provider,
      {
        from,
        to,
        cc,
        bcc,
        subject: input.subject,
        headers,
        html,
        text: prepared.text,
        attachments: prepared.attachments.map((attachment) => ({
          filename: attachment.filename,
          type: attachment.type,
          content: attachment.content,
          disposition: attachment.disposition === "inline" && attachment.contentId ? "inline" : "attachment",
          contentId: attachment.contentId
        }))
      },
      jobId
    );
    await db.update(messages).set({
      status: "sent",
      providerMessageId: response.messageId,
      threadId: input.threadId ?? normalizeMessageId(response.messageId) ?? messageId
    }).where(eq23(messages.id, messageId));
    await db.update(outboundJobs).set({ status: "sent", updatedAt: /* @__PURE__ */ new Date() }).where(eq23(outboundJobs.id, jobId));
    if (input.followUpDays) {
      await setFollowUp(env2, { messageId, userId: input.userId, days: input.followUpDays }).catch((error) => console.error("Follow-up reminder skipped", error));
    }
    await dispatchWebhooks(env2, input.userId, "message.outbound", {
      messageId,
      providerMessageId: response.messageId,
      to: toAddr,
      cc: cc.length ? joinEmailAddressList(cc) : void 0
    });
    await createAuditLog(env2, {
      actorUserId: input.userId,
      mailboxId,
      messageId,
      action: "email.send",
      metadata: { to: toAddr, cc: cc.length ? joinEmailAddressList(cc) : void 0, subject: input.subject }
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Send failed";
    await db.update(messages).set({ status: "failed" }).where(eq23(messages.id, messageId));
    await db.update(outboundJobs).set({ status: "failed", error, updatedAt: /* @__PURE__ */ new Date() }).where(eq23(outboundJobs.id, jobId));
    await dispatchWebhooks(env2, input.userId, "message.failed", { messageId, error });
    throw err;
  }
}
async function withTrackingPixel(env2, messageId, from, html, publicOrigin) {
  try {
    const host = await getTrackingHostForSender(env2, from);
    const origin = host ? `https://${host}` : resolveTrackingOrigin(env2.APP_URL, publicOrigin);
    if (!origin) return html;
    const token = await ensureTrackingToken(env2, messageId);
    return injectTrackingPixel(html, buildTrackingPixelUrl(origin, token));
  } catch (error) {
    console.error("Read receipt skipped", error);
    return html;
  }
}
async function enqueueScheduledDelivery(env2, delivery, scheduledAt) {
  const delaySeconds = Math.min(
    MAX_QUEUE_DELAY_SECONDS,
    Math.max(1, Math.ceil((scheduledAt.getTime() - Date.now()) / 1e3))
  );
  await env2.OUTBOUND_QUEUE.send(
    {
      kind: "email.scheduled",
      jobId: delivery.jobId,
      messageId: delivery.messageId,
      scheduledAt: scheduledAt.toISOString()
    },
    { delaySeconds }
  );
}

// src/lib/jmap/identities.ts
async function buildIdentities(ctx) {
  const list = [];
  const sendable = (await listJmapMailboxes(ctx)).filter((mailbox) => mailbox.permission !== "read_only");
  const addresses = await Promise.all(sendable.map((mailbox) => listSendableAddresses(ctx, mailbox)));
  for (const [index, mailbox] of sendable.entries()) {
    for (const address of addresses[index]) {
      list.push({
        id: identityId(mailbox.id, address),
        name: mailbox.displayName ?? "",
        email: address,
        replyTo: null,
        bcc: null,
        textSignature: "",
        htmlSignature: "",
        mayDelete: false
      });
    }
  }
  return list;
}
var identityGet = async (ctx, args) => {
  const all = await buildIdentities(ctx);
  const ids = args.ids;
  const list = ids ? all.filter((item) => ids.includes(item.id)) : all;
  const found = new Set(list.map((item) => item.id));
  return { accountId: ctx.accountId, state: "identities", list, notFound: ids ? ids.filter((id) => !found.has(id)) : [] };
};
var identityChanges = async () => ({ type: "cannotCalculateChanges" });
var identitySet = async (ctx, args) => ({
  accountId: ctx.accountId,
  oldState: "identities",
  newState: "identities",
  created: {},
  updated: {},
  destroyed: [],
  notCreated: Object.fromEntries(Object.keys(args.create ?? {}).map((id) => [id, { type: "forbidden" }])),
  notUpdated: Object.fromEntries(Object.keys(args.update ?? {}).map((id) => [id, { type: "forbidden" }])),
  notDestroyed: Object.fromEntries((args.destroy ?? []).map((id) => [id, { type: "forbidden" }]))
});
var emailSubmissionSet = async (ctx, args) => {
  const oldState = await getEmailState(ctx);
  const created = {};
  const notCreated = {};
  const destroyedEmails = [];
  for (const [creationId, value] of Object.entries(args.create ?? {})) {
    const emailId = ctx.createdIds[String(value.emailId).replace(/^#/, "")] ?? String(value.emailId ?? "");
    const identity = typeof value.identityId === "string" ? decodeIdentityId(value.identityId) : null;
    const accessible = await listJmapMailboxes(ctx);
    if (!identity || !accessible.some((mailbox) => mailbox.id === identity.mailboxId && mailbox.permission !== "read_only")) {
      notCreated[creationId] = { type: "invalidProperties", properties: ["identityId"] };
      continue;
    }
    const [draft] = await ctx.db.select().from(messages).where(and16(eq24(messages.id, emailId), eq24(messages.status, "draft"))).limit(1);
    if (!draft || draft.userId !== ctx.auth.userId || draft.mailboxId !== identity.mailboxId) {
      notCreated[creationId] = { type: "invalidProperties", properties: ["emailId"], description: "Not a draft of this account" };
      continue;
    }
    try {
      const attachments = await loadMessageAttachmentContents(ctx.env, draft.id);
      const result = await sendEmail(ctx.env, {
        userId: ctx.auth.userId,
        from: identity.address,
        to: draft.toAddr,
        cc: draft.ccAddr ?? void 0,
        bcc: draft.bccAddr ?? void 0,
        subject: draft.subject ?? "(no subject)",
        text: draft.textBody ?? void 0,
        html: draft.htmlBody ?? void 0,
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        threadId: draft.threadId,
        mailboxId: identity.mailboxId,
        attachments,
        publicOrigin: ctx.origin
      });
      try {
        await deleteMessageWithObjects(ctx.env, ctx.db, draft.id, draft.rawR2Key);
      } catch (error) {
        console.error(`Failed to clean up submitted draft ${draft.id}`, error);
      }
      destroyedEmails.push(draft.id);
      ctx.createdIds[creationId] = result.messageId;
      created[creationId] = {
        id: result.messageId,
        identityId: value.identityId,
        emailId: result.messageId,
        threadId: draft.threadId ?? result.messageId,
        envelope: null,
        sendAt: (/* @__PURE__ */ new Date()).toISOString(),
        undoStatus: "final",
        deliveryStatus: null,
        dsnBlobIds: [],
        mdnBlobIds: []
      };
    } catch (error) {
      notCreated[creationId] = { type: "forbidden", description: error instanceof Error ? error.message : "Send failed" };
    }
  }
  return {
    accountId: ctx.accountId,
    oldState,
    newState: await getEmailState(ctx),
    created,
    updated: {},
    destroyed: [],
    notCreated,
    notUpdated: Object.fromEntries(Object.keys(args.update ?? {}).map((id) => [id, { type: "forbidden" }])),
    notDestroyed: Object.fromEntries((args.destroy ?? []).map((id) => [id, { type: "forbidden" }])),
    // Surfaced so the processor can append the implicit Email/set response.
    __destroyedEmails: destroyedEmails
  };
};
var emailSubmissionGet = async (ctx, args) => ({
  accountId: ctx.accountId,
  state: await getEmailState(ctx),
  list: [],
  notFound: args.ids ?? [] ?? []
});
var emailSubmissionQuery = async (ctx) => ({ accountId: ctx.accountId, queryState: await getEmailState(ctx), canCalculateChanges: false, position: 0, ids: [], total: 0 });
var emailSubmissionChanges = async () => ({ type: "cannotCalculateChanges" });

// src/lib/jmap/processor.ts
var METHODS = {
  "Core/echo": async (_ctx, args) => args,
  "Mailbox/get": mailboxGet,
  "Mailbox/query": mailboxQuery,
  "Mailbox/changes": mailboxChanges,
  "Mailbox/queryChanges": async () => ({ type: "cannotCalculateChanges" }),
  "Mailbox/set": mailboxSet,
  "Thread/get": threadGet,
  "Thread/changes": threadChanges,
  "Email/get": emailGet,
  "Email/query": emailQuery,
  "Email/changes": emailChanges,
  "Email/queryChanges": emailQueryChanges,
  "Email/set": emailSet,
  "Email/copy": emailUnsupported("Email/copy"),
  "Email/import": emailImport,
  "Email/parse": emailUnsupported("Email/parse"),
  "SearchSnippet/get": searchSnippetGet,
  "Identity/get": identityGet,
  "Identity/changes": identityChanges,
  "Identity/set": identitySet,
  "EmailSubmission/get": emailSubmissionGet,
  "EmailSubmission/query": emailSubmissionQuery,
  "EmailSubmission/changes": emailSubmissionChanges,
  "EmailSubmission/queryChanges": async () => ({ type: "cannotCalculateChanges" }),
  "EmailSubmission/set": emailSubmissionSet
};
var SUPPORTED_CAPABILITIES = /* @__PURE__ */ new Set([CAPABILITY_CORE, CAPABILITY_MAIL, CAPABILITY_SUBMISSION]);
var JMAP_CAPABILITY_NAMESPACE = "urn:ietf:params:jmap:";
function resolvePointer(value, path) {
  const segments = path.split("/").slice(1).map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = value;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === "*" && Array.isArray(current)) {
      const rest = `/${segments.slice(index + 1).join("/")}`;
      return current.flatMap((item) => {
        const resolved = segments.length > index + 1 ? resolvePointer(item, rest) : item;
        return Array.isArray(resolved) ? resolved : [resolved];
      });
    }
    if (current === null || typeof current !== "object") throw new JmapError("invalidResultReference", `Path ${path} not found`);
    current = current[segment];
  }
  return current;
}
function resolveReferences(args, responses) {
  const resolved = {};
  for (const [key, value] of Object.entries(args)) {
    if (!key.startsWith("#")) {
      resolved[key] = value;
      continue;
    }
    const ref = value;
    const source = responses.find(([name, , callId]) => callId === ref.resultOf && name === ref.name);
    if (!source) throw new JmapError("invalidResultReference", `No response ${ref.name} for call ${ref.resultOf}`);
    resolved[key.slice(1)] = resolvePointer(source[1], ref.path);
  }
  return resolved;
}
function resolveCreatedIds(args, createdIds) {
  const walk = (value) => {
    if (typeof value === "string" && value.startsWith("#") && createdIds[value.slice(1)]) return createdIds[value.slice(1)];
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(args);
}
var SLOW_REQUEST_MS = 200;
var READ_ONLY_METHOD = /\/(get|query|changes|queryChanges)$|^Core\/echo$/;
function describeCall(name, args, ms) {
  const size = (value) => Array.isArray(value) ? value.length : value === null || value === void 0 ? void 0 : typeof value === "object" ? "ref" : value;
  return {
    name,
    ms,
    ids: size(args.ids ?? args["#ids"]),
    properties: Array.isArray(args.properties) ? args.properties.length : void 0,
    bodyProperties: Array.isArray(args.bodyProperties) ? args.bodyProperties.length : void 0,
    fetchBodyValues: args.fetchTextBodyValues || args.fetchHTMLBodyValues || args.fetchAllBodyValues ? true : void 0,
    limit: typeof args.limit === "number" ? args.limit : void 0,
    position: typeof args.position === "number" ? args.position : void 0,
    filter: args.filter && typeof args.filter === "object" ? Object.keys(args.filter).join(",") : void 0,
    collapseThreads: args.collapseThreads === true ? true : void 0,
    sinceState: typeof args.sinceState === "string" ? true : void 0
  };
}
async function processRequest(ctx, request) {
  const responses = [];
  Object.assign(ctx.createdIds, request.createdIds ?? {});
  const startedAt = Date.now();
  const calls = [];
  for (const [name, rawArgs, callId] of request.methodCalls) {
    const callStartedAt = Date.now();
    const readOnly = READ_ONLY_METHOD.test(name);
    if (!readOnly) ctx.memo = void 0;
    const handler = METHODS[name];
    if (!handler) {
      responses.push(["error", { type: "unknownMethod" }, callId]);
      continue;
    }
    try {
      const args = resolveCreatedIds(resolveReferences(rawArgs ?? {}, responses), ctx.createdIds);
      if (args.accountId !== void 0 && args.accountId !== ctx.accountId && name !== "Core/echo") {
        responses.push(["error", { type: "accountNotFound" }, callId]);
        continue;
      }
      const result = await handler(readOnly ? ctx : { ...ctx, memo: null }, args);
      calls.push(describeCall(name, args, Date.now() - callStartedAt));
      if ("type" in result && typeof result.type === "string" && !("accountId" in result) && !("list" in result)) {
        responses.push(["error", result, callId]);
        continue;
      }
      const { __destroyedEmails, ...clean } = result;
      responses.push([name, clean, callId]);
      if (name === "EmailSubmission/set" && __destroyedEmails?.length) {
        responses.push(["Email/set", { accountId: ctx.accountId, oldState: clean.oldState, newState: clean.newState, updated: {}, destroyed: __destroyedEmails, created: {} }, callId]);
      }
    } catch (error) {
      if (error instanceof JmapError) {
        responses.push(["error", error.toMethodError(), callId]);
      } else {
        console.error(`JMAP ${name} failed`, error);
        responses.push(["error", { type: "serverFail", description: "The method failed on the server" }, callId]);
      }
    }
  }
  if (request.methodCalls.some(([name]) => !READ_ONLY_METHOD.test(name))) ctx.memo = void 0;
  const stateStartedAt = Date.now();
  const state = await sessionState(ctx);
  const totalMs = Date.now() - startedAt;
  if (totalMs >= SLOW_REQUEST_MS) console.log("JMAP slow request", JSON.stringify({ totalMs, stateMs: Date.now() - stateStartedAt, calls }));
  return { methodResponses: responses, createdIds: Object.keys(ctx.createdIds).length ? ctx.createdIds : void 0, sessionState: state };
}
async function sessionState(ctx) {
  return getEmailState(ctx);
}
function validateRequest(body) {
  if (!body || typeof body !== "object") throw new JmapError("notRequest");
  const request = body;
  if (!Array.isArray(request.using) || !Array.isArray(request.methodCalls)) throw new JmapError("notRequest");
  for (const capability of request.using) {
    const name = String(capability);
    if (SUPPORTED_CAPABILITIES.has(name) || name.startsWith(JMAP_CAPABILITY_NAMESPACE)) continue;
    throw new JmapError("unknownCapability", name);
  }
  if (request.methodCalls.length > LIMITS.maxCallsInRequest) throw new JmapError("limit", "Too many method calls", { limit: "maxCallsInRequest" });
  for (const call of request.methodCalls) {
    if (!Array.isArray(call) || call.length !== 3 || typeof call[0] !== "string" || typeof call[2] !== "string") throw new JmapError("notRequest");
  }
  return request;
}
export {
  SUPPORTED_CAPABILITIES,
  processRequest,
  sessionState,
  validateRequest
};
