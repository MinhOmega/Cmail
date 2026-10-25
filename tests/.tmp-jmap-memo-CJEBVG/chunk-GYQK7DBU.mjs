// src/db/index.ts
import { drizzle } from "drizzle-orm/d1";

// src/db/schema/index.ts
import { sql as sql2 } from "drizzle-orm";

// src/db/schema/kits.ts
import { sql } from "drizzle-orm";
import * as sqlite from "drizzle-orm/sqlite-core";
import * as pg from "drizzle-orm/pg-core";
import * as mysql from "drizzle-orm/mysql-core";

// src/db/dialect.ts
var DRIVER_ALIASES = {
  d1: "d1",
  libsql: "libsql",
  turso: "libsql",
  "better-sqlite3": "better-sqlite3",
  sqlite: "better-sqlite3",
  "bun-sqlite": "bun-sqlite",
  bun: "bun-sqlite",
  "node-postgres": "node-postgres",
  pg: "node-postgres",
  postgres: "node-postgres",
  postgresql: "node-postgres",
  supabase: "node-postgres",
  "postgres-js": "postgres-js",
  postgresjs: "postgres-js",
  neon: "neon",
  vercel: "neon",
  pglite: "pglite",
  mysql2: "mysql2",
  mysql: "mysql2",
  tidb: "mysql2",
  mariadb: "mysql2",
  planetscale: "planetscale"
};
var DRIVER_DIALECT = {
  d1: "sqlite",
  libsql: "sqlite",
  "better-sqlite3": "sqlite",
  "bun-sqlite": "sqlite",
  "node-postgres": "postgres",
  "postgres-js": "postgres",
  neon: "postgres",
  pglite: "postgres",
  mysql2: "mysql",
  planetscale: "mysql"
};
function schemeOf(url) {
  return /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())?.[1]?.toLowerCase() ?? "";
}
function hostOf(url) {
  try {
    return new URL(url.replace(/^(postgres(ql)?|mysql2?|mariadb|libsql):/i, "https:")).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function inferDriver(url) {
  const scheme = schemeOf(url);
  const host = hostOf(url);
  if (scheme === "postgres" || scheme === "postgresql") {
    if (host.endsWith(".neon.tech") || host.endsWith(".vercel-storage.com")) return "neon";
    return "node-postgres";
  }
  if (scheme === "pglite") return "pglite";
  if (scheme === "mysql" || scheme === "mysql2" || scheme === "mariadb") {
    if (host.endsWith(".psdb.cloud") || host.endsWith(".planetscale.com")) return "planetscale";
    return "mysql2";
  }
  if (scheme === "libsql" || scheme === "wss" || scheme === "ws" || scheme === "http" || scheme === "https") return "libsql";
  if (scheme === "file" || scheme === "sqlite" || !scheme) return "better-sqlite3";
  throw new Error(`Cannot infer a database driver from DATABASE_URL scheme "${scheme}". Set DATABASE_DRIVER.`);
}
function text(env, key) {
  const value = env?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function resolveDatabaseConfig(env, hyperdriveUrl) {
  const url = text(env, "DATABASE_URL") ?? hyperdriveUrl;
  const driverName = text(env, "DATABASE_DRIVER")?.toLowerCase();
  if (!url) {
    if (driverName && driverName !== "d1") throw new Error(`DATABASE_DRIVER=${driverName} needs DATABASE_URL (or a HYPERDRIVE binding).`);
    return { dialect: "sqlite", driver: "d1" };
  }
  let driver;
  if (driverName) {
    driver = DRIVER_ALIASES[driverName];
    if (!driver) throw new Error(`Unsupported DATABASE_DRIVER "${driverName}". Supported: ${Object.keys(DRIVER_ALIASES).join(", ")}.`);
  } else {
    driver = inferDriver(url);
  }
  return { dialect: DRIVER_DIALECT[driver], driver, url, authToken: text(env, "DATABASE_AUTH_TOKEN") };
}
function schemaDialect() {
  const env = globalThis.process?.env;
  const forced = text(env, "CMAIL_DB_DIALECT");
  if (forced === "sqlite" || forced === "postgres" || forced === "mysql") return forced;
  if (forced) throw new Error(`CMAIL_DB_DIALECT must be sqlite, postgres or mysql, got "${forced}".`);
  const named = text(env, "DATABASE_DRIVER")?.toLowerCase();
  if (named && !text(env, "DATABASE_URL") && DRIVER_ALIASES[named]) return DRIVER_DIALECT[DRIVER_ALIASES[named]];
  try {
    return resolveDatabaseConfig(env).dialect;
  } catch {
    return "sqlite";
  }
}

// src/db/schema/kits.ts
var sqliteKit = {
  table: sqlite.sqliteTable,
  text: sqlite.text,
  integer: (name) => sqlite.integer(name),
  bool: (name) => sqlite.integer(name, { mode: "boolean" }),
  timestamp: (name) => sqlite.integer(name, { mode: "timestamp" }),
  autoId: (name) => sqlite.integer(name).primaryKey({ autoIncrement: true }),
  index: sqlite.index,
  uniqueIndex: sqlite.uniqueIndex,
  desc: (column) => sql`${column} desc`,
  nowSeconds: sql`(unixepoch())`
};
var pgTimestamp = pg.customType({
  dataType: () => "bigint",
  fromDriver: (value) => new Date(Number(value) * 1e3),
  toDriver: (value) => Math.floor(value.getTime() / 1e3)
});
var pgKit = {
  table: pg.pgTable,
  text: (name, config) => pg.text(name, config),
  integer: (name) => pg.bigint(name, { mode: "number" }),
  bool: (name) => pg.boolean(name),
  timestamp: (name) => pgTimestamp(name),
  autoId: (name) => pg.bigserial(name, { mode: "number" }).primaryKey(),
  index: pg.index,
  uniqueIndex: pg.uniqueIndex,
  desc: (column) => sql`${column} desc`,
  nowSeconds: sql`(extract(epoch from now())::bigint)`
};
var mysqlTimestamp = mysql.customType({
  dataType: () => "bigint",
  fromDriver: (value) => new Date(Number(value) * 1e3),
  toDriver: (value) => Math.floor(value.getTime() / 1e3)
});
var KEY_LENGTH = 191;
var LONG_KEYS = {
  provider_message_id: 512,
  thread_id: 512,
  raw_r2_key: 512,
  r2_key: 512,
  endpoint: 512,
  email: 320,
  recipient: 320,
  name: 255,
  hostname: 255
};
var INDEX_BYTE_BUDGET = 3e3;
var KEYED_METHODS = /* @__PURE__ */ new Set(["unique", "primaryKey", "references"]);
var MysqlTextColumn = class {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (typeof property !== "string" || property in target) return Reflect.get(target, property, receiver);
        return (...args) => {
          target.calls.push([property, args]);
          if (KEYED_METHODS.has(property)) target.keyed = true;
          return receiver;
        };
      }
    });
  }
  name;
  config;
  calls = [];
  keyed = false;
  materialize(keyed) {
    let builder;
    if (this.config) {
      builder = mysql.varchar(this.name, { length: 64, enum: this.config.enum });
    } else if (keyed) {
      builder = mysql.varchar(this.name, { length: LONG_KEYS[this.name] ?? KEY_LENGTH });
    } else {
      builder = mysql.longtext(this.name);
      const literal = builder.default.bind(builder);
      builder.default = (value) => typeof value === "string" ? literal(sql.raw(`('${value.replace(/'/g, "''")}')`)) : literal(value);
    }
    for (const [method, args] of this.calls) builder = builder[method](...args);
    return builder;
  }
};
var mysqlText = (name, config) => new MysqlTextColumn(name, config);
function indexedProperties(extra) {
  const touched = /* @__PURE__ */ new Set();
  if (!extra) return touched;
  extra(new Proxy({}, { get: (_, property) => (typeof property === "string" && touched.add(property), { __column: property }) }));
  return touched;
}
function mysqlTable2(name, columns, extra) {
  const indexed = indexedProperties(extra);
  const built = Object.fromEntries(
    Object.entries(columns).map(([property, column]) => [property, column instanceof MysqlTextColumn ? column.materialize(column.keyed || indexed.has(property)) : column])
  );
  return mysql.mysqlTable(name, built, extra);
}
function columnBytes(column) {
  const value = column;
  if (typeof value?.length === "number") return value.length * 4;
  return 8;
}
var isExpression = (column) => !!column && typeof column === "object" && "queryChunks" in column;
function fitColumns(columns, keepAll) {
  const parts = columns.filter((column) => !isExpression(column));
  if (keepAll) return parts;
  const kept = [];
  let used = 0;
  for (const part of parts) {
    const bytes = columnBytes(part);
    if (kept.length > 0 && used + bytes > INDEX_BYTE_BUDGET) break;
    kept.push(part);
    used += bytes;
  }
  return kept;
}
function mysqlIndex(name) {
  const builder = mysql.index(name);
  return {
    on: (...columns) => builder.on(...fitColumns(columns, false))
  };
}
function mysqlUniqueIndex(name) {
  const builder = mysql.uniqueIndex(name);
  return {
    on: (...columns) => {
      const unique = builder.on(...fitColumns(columns, true));
      unique.where = () => mysql.index(name).on(...fitColumns(columns, true));
      return unique;
    }
  };
}
var mysqlKit = {
  table: mysqlTable2,
  text: mysqlText,
  integer: (name) => mysql.bigint(name, { mode: "number" }),
  bool: (name) => mysql.boolean(name),
  timestamp: (name) => mysqlTimestamp(name),
  autoId: (name) => mysql.bigint(name, { mode: "number" }).primaryKey().autoincrement(),
  index: mysqlIndex,
  uniqueIndex: mysqlUniqueIndex,
  // Descending key parts are only a sort hint; MySQL builds the index ascending and scans it backwards.
  desc: (column) => column,
  nowSeconds: sql`(unix_timestamp())`
};
function kitFor(dialect) {
  if (dialect === "postgres") return pgKit;
  if (dialect === "mysql") return mysqlKit;
  return sqliteKit;
}
var kit = kitFor(schemaDialect());

// src/db/schema/index.ts
var { table: sqliteTable2, text: text4, integer: integer2, bool, timestamp, autoId, index: index4, uniqueIndex: uniqueIndex4, desc, nowSeconds } = kit;
var users = sqliteTable2("users", {
  id: text4("id").primaryKey(),
  email: text4("email").notNull().unique(),
  resetEmail: text4("reset_email"),
  forwardingEmail: text4("forwarding_email"),
  passwordHash: text4("password_hash").notNull(),
  name: text4("name").notNull(),
  bookingUsername: text4("booking_username"),
  timeZone: text4("time_zone"),
  avatarKey: text4("avatar_key"),
  role: text4("role", { enum: ["admin", "user"] }).notNull().default("user"),
  // Exactly one account is the primary admin: the one created during setup.
  // They own administrator management and can hand the role to another account.
  isPrimaryAdmin: bool("is_primary_admin").notNull().default(false),
  disabled: bool("disabled").notNull().default(false),
  canManageMailboxes: bool("can_manage_mailboxes").notNull().default(false),
  // Capabilities the primary admin grants to other admins.
  canManageDomains: bool("can_manage_domains").notNull().default(false),
  canManageUsers: bool("can_manage_users").notNull().default(false),
  keyboardShortcutsEnabled: bool("keyboard_shortcuts_enabled").notNull().default(true),
  spamProtectionEnabled: bool("spam_protection_enabled").notNull().default(true),
  /** Days a message may stay in Trash or Spam before the scheduled purge deletes it; null keeps it forever. */
  trashRetentionDays: integer2("trash_retention_days"),
  // Off shows the mailbox only. On shows Name <mailbox> on To, Cc, and Bcc.
  showFullRecipientAddresses: bool("show_full_recipient_addresses").notNull().default(false),
  // When the reader loads remote images and styles without being asked: always ask, only for senders not yet allowed, or always.
  remoteContentMode: text4("remote_content_mode", { enum: ["ask", "new_sender", "allow"] }).notNull().default("allow"),
  // TOTP second factor. The secret is written at enrolment and only counts
  // once the user has proven a code from their authenticator.
  totpSecret: text4("totp_secret"),
  totpEnabled: bool("totp_enabled").notNull().default(false),
  totpConfirmedAt: timestamp("totp_confirmed_at"),
  lastSignInAt: timestamp("last_sign_in_at"),
  // Set when an admin deletes the account. The account is also `disabled` and can be restored until the
  // retention window ends, after which the scheduled purge removes it and its data.
  deletedAt: timestamp("deleted_at"),
  createdByUserId: text4("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  uniqueIndex4("users_booking_username_idx").on(t.bookingUsername),
  index4("users_created_by_idx").on(t.createdByUserId)
]);
var domains = sqliteTable2(
  "domains",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    hostname: text4("hostname").notNull(),
    zoneId: text4("zone_id").notNull(),
    status: text4("status", { enum: ["pending", "active", "error"] }).notNull().default("pending"),
    routingStatus: text4("routing_status"),
    sendingSubdomainTag: text4("sending_subdomain_tag"),
    sendingProvider: text4("sending_provider", { enum: ["none", "cloudflare", "resend", "ses"] }).notNull().default("none"),
    receivingProvider: text4("receiving_provider", { enum: ["none", "cloudflare", "resend", "ses"] }).notNull().default("cloudflare"),
    sendingRequested: bool("sending_requested").notNull().default(false),
    sendingEnabled: bool("sending_enabled").notNull().default(false),
    routingEnabled: bool("routing_enabled").notNull().default(false),
    /** The operator skipped adding/checking DNS; set until they confirm the records exist. */
    dnsSkipped: bool("dns_skipped").notNull().default(false),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("domains_hostname_idx").on(t.hostname),
    index4("domains_user_idx").on(t.userId)
  ]
);
var mailboxes = sqliteTable2(
  "mailboxes",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    domainId: text4("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
    localPart: text4("local_part").notNull(),
    displayName: text4("display_name"),
    signature: text4("signature"),
    autoReplyEnabled: bool("auto_reply_enabled").notNull().default(false),
    autoReplySubject: text4("auto_reply_subject").notNull().default("Out of office"),
    autoReplyBody: text4("auto_reply_body").notNull().default(""),
    avatarKey: text4("avatar_key"),
    type: text4("type", { enum: ["personal", "shared"] }).notNull().default("personal"),
    useAllDomains: bool("use_all_domains").notNull().default(true),
    disabled: bool("disabled").notNull().default(false),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [uniqueIndex4("mailboxes_address_idx").on(t.domainId, t.localPart), index4("mailboxes_user_idx").on(t.userId)]
);
var mailboxAliases = sqliteTable2(
  "mailbox_aliases",
  {
    id: text4("id").primaryKey(),
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    domainId: text4("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
    localPart: text4("local_part").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("mailbox_aliases_address_idx").on(t.domainId, t.localPart),
    index4("mailbox_aliases_mailbox_idx").on(t.mailboxId)
  ]
);
var autoReplyDeliveries = sqliteTable2(
  "auto_reply_deliveries",
  {
    id: text4("id").primaryKey(),
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    recipient: text4("recipient").notNull(),
    sentAt: timestamp("sent_at").notNull()
  },
  (t) => [
    uniqueIndex4("auto_reply_deliveries_mailbox_recipient_idx").on(t.mailboxId, t.recipient),
    index4("auto_reply_deliveries_sent_idx").on(t.sentAt)
  ]
);
var mailboxAccess = sqliteTable2(
  "mailbox_access",
  {
    id: text4("id").primaryKey(),
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    permission: text4("permission", { enum: ["read_only", "send_as", "send_on_behalf", "full_access"] }).notNull().default("read_only"),
    createdByUserId: text4("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("mailbox_access_mailbox_user_idx").on(t.mailboxId, t.userId),
    index4("mailbox_access_user_idx").on(t.userId),
    index4("mailbox_access_mailbox_idx").on(t.mailboxId),
    index4("mailbox_access_created_by_idx").on(t.createdByUserId)
  ]
);
var contacts = sqliteTable2(
  "contacts",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    email: text4("email").notNull(),
    displayName: text4("display_name"),
    avatarKey: text4("avatar_key"),
    source: text4("source", { enum: ["manual", "inbound", "outbound"] }).notNull().default("inbound"),
    blocked: bool("blocked").notNull().default(false),
    // Set when the user allows remote content from this sender; "new_sender" mode loads it without asking afterwards.
    remoteContentAllowed: bool("remote_content_allowed").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("contacts_user_email_idx").on(t.userId, t.email),
    index4("contacts_user_idx").on(t.userId)
  ]
);
var folders = sqliteTable2(
  "folders",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    name: text4("name").notNull(),
    color: text4("color").notNull().default("#2563eb"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("folders_mailbox_name_idx").on(t.mailboxId, t.name),
    index4("folders_user_idx").on(t.userId),
    index4("folders_mailbox_idx").on(t.mailboxId)
  ]
);
var jmapMailboxRevisions = sqliteTable2("jmap_mailbox_revisions", {
  mailboxId: text4("mailbox_id").primaryKey(),
  revision: integer2("revision").notNull().default(0)
});
var jmapChanges = sqliteTable2(
  "jmap_changes",
  {
    seq: autoId("seq"),
    mailboxId: text4("mailbox_id").notNull(),
    objectType: text4("object_type", { enum: ["email", "mailbox"] }).notNull(),
    objectId: text4("object_id").notNull(),
    threadId: text4("thread_id"),
    change: text4("change", { enum: ["created", "updated", "destroyed"] }).notNull(),
    createdAt: integer2("created_at").notNull().default(nowSeconds)
  },
  (table) => [index4("jmap_changes_mailbox_seq_idx").on(table.mailboxId, table.seq)]
);
var jmapChangeFloor = sqliteTable2("jmap_change_floor", {
  id: integer2("id").primaryKey(),
  seq: integer2("seq").notNull().default(0)
});
var apiKeys = sqliteTable2("api_keys", {
  id: text4("id").primaryKey(),
  /** `device` keys come from a mobile sign-in (`/api/auth/device`) and are listed under Devices. */
  kind: text4("kind", { enum: ["legacy", "mcp", "device"] }).notNull().default("legacy"),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text4("name").notNull(),
  prefix: text4("prefix").notNull(),
  keyHash: text4("key_hash").notNull(),
  scopes: text4("scopes").notNull(),
  mailboxScopeEnabled: bool("mailbox_scope_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  lastUsedAt: timestamp("last_used_at")
}, (t) => [index4("api_keys_user_idx").on(t.userId)]);
var messages = sqliteTable2(
  "messages",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mailboxId: text4("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    direction: text4("direction", { enum: ["inbound", "outbound"] }).notNull(),
    providerMessageId: text4("provider_message_id"),
    folderId: text4("folder_id").references(() => folders.id, { onDelete: "set null" }),
    fromAddr: text4("from_addr").notNull(),
    toAddr: text4("to_addr").notNull(),
    ccAddr: text4("cc_addr"),
    bccAddr: text4("bcc_addr"),
    /** Full Reply-To header, comma-joined. Replies go here instead of `fromAddr` when set. */
    replyTo: text4("reply_to"),
    subject: text4("subject"),
    snippet: text4("snippet"),
    textBody: text4("text_body"),
    htmlBody: text4("html_body"),
    rawR2Key: text4("raw_r2_key"),
    status: text4("status").notNull().default("received"),
    read: bool("read").notNull().default(false),
    starred: bool("starred").notNull().default(false),
    snoozedUntil: timestamp("snoozed_until"),
    threadId: text4("thread_id"),
    // RFC 5322 threading headers, kept so replies land in the right conversation
    // and so outgoing replies can carry them on to the recipient's client.
    inReplyTo: text4("in_reply_to"),
    references: text4("references_header"),
    spamScore: integer2("spam_score"),
    spamVerdict: text4("spam_verdict", { enum: ["inbox", "suspicious", "spam"] }),
    spamSignals: text4("spam_signals"),
    spamAnalyzedAt: timestamp("spam_analyzed_at"),
    spamAnalysisError: text4("spam_analysis_error"),
    /** When the message last entered Trash or Spam; maintained by triggers (migration 0053). */
    trashedAt: timestamp("trashed_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("messages_user_created_idx").on(t.userId, t.createdAt),
    index4("messages_mailbox_idx").on(t.mailboxId),
    index4("messages_folder_idx").on(t.folderId),
    index4("messages_thread_idx").on(t.mailboxId, t.threadId),
    index4("messages_provider_message_idx").on(t.mailboxId, t.providerMessageId),
    index4("messages_raw_r2_key_idx").on(t.rawR2Key),
    index4("messages_trashed_at_idx").on(t.trashedAt),
    index4("messages_inbox_page_idx").on(
      t.mailboxId,
      t.status,
      t.folderId,
      desc(t.createdAt),
      desc(t.id)
    ),
    index4("messages_thread_key_idx").on(
      t.mailboxId,
      t.status,
      t.folderId,
      sql2`coalesce(${t.threadId}, ${t.id})`,
      t.createdAt
    ),
    index4("messages_mailbox_thread_key_idx").on(t.mailboxId, sql2`coalesce(${t.threadId}, ${t.id})`),
    index4("messages_nav_cover_idx").on(
      t.mailboxId,
      t.status,
      t.folderId,
      desc(t.createdAt),
      desc(t.id),
      t.direction,
      t.read,
      t.threadId,
      t.snoozedUntil
    ),
    // Covering index for the folder-counts GROUP BY: lets the counts
    // endpoint stream grouped rows straight off the index instead of
    // sorting the whole table.
    index4("messages_counts_cover_idx").on(
      t.mailboxId,
      t.folderId,
      t.direction,
      t.status,
      t.read,
      t.starred,
      t.snoozedUntil
    ),
    // Conversation paging partitions by coalesce(thread_id, id) and orders
    // each partition by created_at desc, so the thread key must precede
    // created_at for the index to feed the window in sorted order. The
    // snoozed_until filter rides the tail column and never touches the
    // table.
    index4("messages_conv_cover_idx").on(
      t.mailboxId,
      t.status,
      sql2`coalesce(${t.threadId}, ${t.id})`,
      t.createdAt,
      t.id,
      t.snoozedUntil
    )
  ]
);
var spamTokenStats = sqliteTable2(
  "spam_token_stats",
  {
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    token: text4("token").notNull(),
    spamCount: integer2("spam_count").notNull().default(0),
    hamCount: integer2("ham_count").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("spam_token_stats_mailbox_token_idx").on(t.mailboxId, t.token),
    index4("spam_token_stats_mailbox_idx").on(t.mailboxId)
  ]
);
var spamReputation = sqliteTable2(
  "spam_reputation",
  {
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    type: text4("type", { enum: ["email", "domain", "fingerprint"] }).notNull(),
    key: text4("key").notNull(),
    messagesSeen: integer2("messages_seen").notNull().default(0),
    spamCount: integer2("spam_count").notNull().default(0),
    hamCount: integer2("ham_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    lastSeenAt: timestamp("last_seen_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("spam_reputation_mailbox_type_key_idx").on(t.mailboxId, t.type, t.key),
    index4("spam_reputation_mailbox_idx").on(t.mailboxId)
  ]
);
var spamFeedback = sqliteTable2(
  "spam_feedback",
  {
    messageId: text4("message_id").primaryKey().references(() => messages.id, { onDelete: "cascade" }),
    mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
    actorUserId: text4("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    classification: text4("classification", { enum: ["spam", "ham"] }).notNull(),
    trainingTokens: text4("training_tokens").notNull(),
    reputationKeys: text4("reputation_keys").notNull(),
    tokenizerVersion: integer2("tokenizer_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("spam_feedback_mailbox_idx").on(t.mailboxId),
    index4("spam_feedback_actor_user_idx").on(t.actorUserId)
  ]
);
var messageAttachments = sqliteTable2(
  "message_attachments",
  {
    id: text4("id").primaryKey(),
    messageId: text4("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    filename: text4("filename").notNull(),
    contentType: text4("content_type").notNull(),
    size: integer2("size").notNull(),
    disposition: text4("disposition", { enum: ["attachment", "inline"] }).notNull().default("attachment"),
    contentId: text4("content_id"),
    r2Key: text4("r2_key").notNull().unique(),
    /** Set when the attachment is moved to the Drive trash; hidden from the email until restored, purged after 30 days. */
    trashedAt: timestamp("trashed_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [index4("message_attachments_message_idx").on(t.messageId)]
);
var sharedAttachmentLinks = sqliteTable2("shared_attachment_links", {
  id: text4("id").primaryKey(),
  attachmentId: text4("attachment_id").notNull().references(() => messageAttachments.id, { onDelete: "cascade" }).unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var outboundJobs = sqliteTable2("outbound_jobs", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: text4("message_id").references(() => messages.id, { onDelete: "set null" }),
  status: text4("status", { enum: ["queued", "sending", "sent", "failed"] }).notNull().default("queued"),
  payload: text4("payload").notNull(),
  error: text4("error"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  index4("outbound_jobs_user_idx").on(t.userId),
  index4("outbound_jobs_message_idx").on(t.messageId)
]);
var messageTracking = sqliteTable2(
  "message_tracking",
  {
    token: text4("token").primaryKey(),
    messageId: text4("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    /** Opens that were not classified as automated prefetches. */
    openCount: integer2("open_count").notNull().default(0),
    firstOpenedAt: timestamp("first_opened_at"),
    lastOpenedAt: timestamp("last_opened_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [uniqueIndex4("message_tracking_message_idx").on(t.messageId)]
);
var domainTrackingHosts = sqliteTable2(
  "domain_tracking_hosts",
  {
    domainId: text4("domain_id").primaryKey().references(() => domains.id, { onDelete: "cascade" }),
    hostname: text4("hostname").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [uniqueIndex4("domain_tracking_hosts_hostname_idx").on(t.hostname)]
);
var messageOpens = sqliteTable2(
  "message_opens",
  {
    id: text4("id").primaryKey(),
    token: text4("token").notNull().references(() => messageTracking.token, { onDelete: "cascade" }),
    openedAt: timestamp("opened_at").notNull(),
    client: text4("client"),
    device: text4("device"),
    country: text4("country"),
    city: text4("city"),
    automated: bool("automated").notNull().default(false)
  },
  (t) => [index4("message_opens_token_idx").on(t.token, t.openedAt)]
);
var userComposePreferences = sqliteTable2("user_compose_preferences", {
  userId: text4("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  trackOpensDefault: bool("track_opens_default").notNull().default(false),
  undoSendSeconds: integer2("undo_send_seconds").notNull().default(15),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var followUps = sqliteTable2(
  "follow_ups",
  {
    id: text4("id").primaryKey(),
    messageId: text4("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at").notNull(),
    status: text4("status", { enum: ["pending", "due", "replied", "dismissed"] }).notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("follow_ups_message_idx").on(t.messageId),
    index4("follow_ups_status_due_idx").on(t.status, t.dueAt),
    index4("follow_ups_user_status_idx").on(t.userId, t.status)
  ]
);
var emailTemplates = sqliteTable2(
  "email_templates",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text4("name").notNull(),
    subject: text4("subject").notNull().default(""),
    textBody: text4("text_body").notNull().default(""),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [index4("email_templates_user_idx").on(t.userId)]
);
var calendarEvents = sqliteTable2(
  "calendar_events",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mailboxId: text4("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    title: text4("title").notNull(),
    description: text4("description").notNull().default(""),
    location: text4("location").notNull().default(""),
    attendees: text4("attendees").notNull().default("[]"),
    color: text4("color").notNull().default("blue"),
    repeat: text4("repeat", { enum: ["none", "daily", "weekly", "monthly", "weekdays"] }).notNull().default("none"),
    repeatDays: text4("repeat_days").notNull().default("[]"),
    repeatAnchorDay: integer2("repeat_anchor_day"),
    repeatUntil: timestamp("repeat_until"),
    excludedOccurrences: text4("excluded_occurrences").notNull().default("[]"),
    timeZone: text4("time_zone"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("calendar_events_user_starts_idx").on(t.userId, t.startsAt),
    index4("calendar_events_mailbox_idx").on(t.mailboxId)
  ]
);
var bookingEvents = sqliteTable2(
  "booking_events",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text4("name").notNull(),
    slug: text4("slug").notNull().default(""),
    description: text4("description").notNull().default(""),
    color: text4("color").notNull().default("#2563eb"),
    hostIds: text4("host_ids").notNull().default("[]"),
    durationMinutes: integer2("duration_minutes").notNull(),
    location: text4("location").notNull().default(""),
    weekdays: text4("weekdays").notNull().default("[1,2,3,4,5]"),
    startTime: text4("start_time").notNull().default("09:00"),
    endTime: text4("end_time").notNull().default("17:00"),
    timeRanges: text4("time_ranges").notNull().default('[{"startTime":"09:00","endTime":"17:00"}]'),
    timeZone: text4("time_zone").notNull().default("UTC"),
    enabled: bool("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [index4("booking_events_user_idx").on(t.userId), uniqueIndex4("booking_events_user_slug_idx").on(t.userId, t.slug)]
);
var routingRules = sqliteTable2(
  "routing_rules",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    domainId: text4("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
    // "mailbox" rules run after delivery and file the message into a folder or system status.
    // "domain" rules run during address resolution and can catch-all, forward, or reject.
    scope: text4("scope", { enum: ["mailbox", "domain"] }).notNull().default("mailbox"),
    name: text4("name"),
    enabled: bool("enabled").notNull().default(true),
    pattern: text4("pattern").notNull(),
    matchField: text4("match_field", {
      enum: ["email", "content", "title", "sender", "recipient"]
    }).notNull().default("email"),
    matchOperator: text4("match_operator", {
      enum: ["contains", "exact", "starts_with", "ends_with", "regex"]
    }).notNull().default("contains"),
    matchValue: text4("match_value").notNull().default(""),
    mailboxId: text4("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    folderId: text4("folder_id").references(() => folders.id, { onDelete: "set null" }),
    action: text4("action", { enum: ["store", "forward", "reject", "spam", "trash"] }).notNull().default("store"),
    forwardTo: text4("forward_to"),
    // Forward actions drop the message by default; keepCopy also delivers it to the mailbox.
    keepCopy: bool("keep_copy").notNull().default(false),
    rejectReason: text4("reject_reason"),
    priority: integer2("priority").notNull().default(0),
    lastMatchedAt: timestamp("last_matched_at"),
    matchCount: integer2("match_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("routing_rules_domain_scope_idx").on(t.domainId, t.scope, t.enabled),
    index4("routing_rules_mailbox_idx").on(t.mailboxId),
    index4("routing_rules_priority_idx").on(t.priority),
    index4("routing_rules_user_idx").on(t.userId),
    index4("routing_rules_folder_idx").on(t.folderId)
  ]
);
var webhooks = sqliteTable2("webhooks", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  description: text4("description"),
  url: text4("url").notNull(),
  secret: text4("secret").notNull(),
  events: text4("events").notNull(),
  enabled: bool("enabled").notNull().default(true),
  maxAttempts: integer2("max_attempts").notNull().default(5),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [index4("webhooks_user_idx").on(t.userId)]);
var webhookDeliveries = sqliteTable2(
  "webhook_deliveries",
  {
    id: text4("id").primaryKey(),
    webhookId: text4("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
    eventType: text4("event_type").notNull(),
    payload: text4("payload").notNull(),
    // pending | delivered | failed | retrying | exhausted
    status: text4("status").notNull().default("pending"),
    attempts: integer2("attempts").notNull().default(0),
    responseStatus: integer2("response_status"),
    error: text4("error"),
    durationMs: integer2("duration_ms"),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextRetryAt: timestamp("next_retry_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("webhook_deliveries_webhook_idx").on(t.webhookId, t.createdAt),
    index4("webhook_deliveries_status_idx").on(t.status)
  ]
);
var sessions = sqliteTable2("sessions", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text4("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [index4("sessions_user_idx").on(t.userId)]);
var pushDevices = sqliteTable2(
  "push_devices",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: text4("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
    platform: text4("platform", { enum: ["apns"] }).notNull(),
    token: text4("token").notNull(),
    environment: text4("environment", { enum: ["production", "sandbox"] }).notNull().default("production"),
    topic: text4("topic").notNull(),
    /** Base64 raw P-256 public key; previews are encrypted to it. */
    publicKey: text4("public_key"),
    previews: bool("previews").notNull().default(true),
    /** The app's own id for this account; echoed in pushes so a tap opens the right account. */
    clientRef: text4("client_ref"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
  },
  (table) => [
    uniqueIndex4("push_devices_platform_token_user_idx").on(table.platform, table.token, table.userId),
    index4("push_devices_user_idx").on(table.userId),
    index4("push_devices_api_key_idx").on(table.apiKeyId)
  ]
);
var pushSubscriptions = sqliteTable2(
  "push_subscriptions",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text4("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    endpoint: text4("endpoint").notNull(),
    p256dh: text4("p256dh").notNull(),
    auth: text4("auth").notNull(),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    uniqueIndex4("push_subscriptions_endpoint_idx").on(t.endpoint),
    index4("push_subscriptions_user_idx").on(t.userId),
    index4("push_subscriptions_session_idx").on(t.sessionId)
  ]
);
var passwordResetTokens = sqliteTable2(
  "password_reset_tokens",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text4("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [index4("password_reset_tokens_user_idx").on(t.userId)]
);
var mfaRecoveryCodes = sqliteTable2(
  "mfa_recovery_codes",
  {
    id: text4("id").primaryKey(),
    userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: text4("code_hash").notNull().unique(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [index4("mfa_recovery_codes_user_idx").on(t.userId)]
);
var loginChallenges = sqliteTable2("login_challenges", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text4("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [index4("login_challenges_user_idx").on(t.userId)]);
var auditLogs = sqliteTable2(
  "audit_logs",
  {
    id: text4("id").primaryKey(),
    actorUserId: text4("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text4("target_user_id").references(() => users.id, { onDelete: "set null" }),
    mailboxId: text4("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    messageId: text4("message_id").references(() => messages.id, { onDelete: "set null" }),
    action: text4("action").notNull(),
    metadata: text4("metadata"),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
  },
  (t) => [
    index4("audit_logs_actor_idx").on(t.actorUserId),
    index4("audit_logs_mailbox_idx").on(t.mailboxId),
    index4("audit_logs_created_idx").on(t.createdAt),
    index4("audit_logs_message_id_idx").on(t.messageId),
    index4("audit_logs_target_user_idx").on(t.targetUserId)
  ]
);
var backupSettings = sqliteTable2("backup_settings", {
  id: text4("id").primaryKey(),
  enabled: bool("enabled").notNull().default(true),
  scheduleType: text4("schedule_type", { enum: ["daily", "weekly", "monthly"] }).notNull().default("daily"),
  scheduleValue: integer2("schedule_value"),
  retentionEnabled: bool("retention_enabled").notNull().default(false),
  retentionDays: integer2("retention_days").notNull().default(30),
  excludedTableGroups: text4("excluded_table_groups").notNull().default("[]"),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var appSettings = sqliteTable2("app_settings", {
  id: text4("id").primaryKey(),
  appName: text4("app_name").notNull().default("Cmail"),
  accentColor: text4("accent_color"),
  outboundAttachmentMaxMb: integer2("outbound_attachment_max_mb").notNull().default(25),
  /** Per-user Drive storage cap in bytes; null means unlimited. */
  driveStorageLimitBytes: integer2("drive_storage_limit_bytes"),
  resendApiKey: text4("resend_api_key"),
  /** JSON: AWS access key, secret and region (see src/lib/aws/config.ts). */
  awsConfig: text4("aws_config"),
  /** JSON: the shared SES inbound resources Cmail created (bucket, topic, rule set, webhook token). */
  sesReceiving: text4("ses_receiving"),
  resendWebhookId: text4("resend_webhook_id"),
  resendWebhookSecret: text4("resend_webhook_secret"),
  iconKey: text4("icon_key"),
  agentEnabled: bool("agent_enabled").notNull().default(true),
  agentProvider: text4("agent_provider", { enum: ["cloudflare", "compatible"] }),
  agentPreset: text4("agent_preset", { enum: ["openai", "openrouter", "groq", "custom"] }),
  agentBaseUrl: text4("agent_base_url"),
  agentApiKey: text4("agent_api_key"),
  agentModel: text4("agent_model"),
  agentModelRates: text4("agent_model_rates"),
  /** Spam analysis lookups; the SPAMHAUS_DQS_KEY and ABUSECH_AUTH_KEY env vars apply when these are null. */
  spamhausDqsKey: text4("spamhaus_dqs_key"),
  abusechAuthKey: text4("abusech_auth_key"),
  spamDomainAgeCheck: bool("spam_domain_age_check").notNull().default(true),
  /** JSON: brands the administrator added for display-name impersonation checks (see src/lib/spam/settings.ts). */
  spamBrands: text4("spam_brands"),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var licenseSettings = sqliteTable2("license_settings", {
  id: text4("id").primaryKey(),
  instanceId: text4("instance_id").notNull().unique(),
  instanceUrl: text4("instance_url"),
  licenseKeyHash: text4("license_key_hash"),
  plan: text4("plan", { enum: ["community", "pro", "team"] }).notNull().default("community"),
  state: text4("state", { enum: ["inactive", "active", "invalid", "expired", "deactivated"] }).notNull().default("inactive"),
  features: text4("features").notNull().default("[]"),
  // Account seats from Paymug's seatLimit; null is unlimited. Rows predating seats keep one.
  seatLimit: integer2("seat_limit").default(1),
  activatedAt: timestamp("activated_at"),
  validatedAt: timestamp("validated_at"),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
});
var backups = sqliteTable2(
  "backups",
  {
    id: text4("id").primaryKey(),
    status: text4("status", { enum: ["queued", "running", "completed", "failed"] }).notNull().default("queued"),
    trigger: text4("trigger", { enum: ["manual", "scheduled"] }).notNull(),
    r2Key: text4("r2_key"),
    filename: text4("filename"),
    size: integer2("size"),
    error: text4("error"),
    createdByUserId: text4("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at")
  },
  (t) => [
    index4("backups_created_idx").on(t.createdAt),
    index4("backups_status_idx").on(t.status),
    index4("backups_created_by_idx").on(t.createdByUserId)
  ]
);
var mailboxAgentSettings = sqliteTable2("mailbox_agent_settings", {
  mailboxId: text4("mailbox_id").primaryKey().references(() => mailboxes.id, { onDelete: "cascade" }),
  enabled: bool("enabled").notNull().default(false),
  modelId: text4("model_id"),
  autoDraftEnabled: bool("auto_draft_enabled").notNull().default(false),
  reviewerUserId: text4("reviewer_user_id").references(() => users.id, { onDelete: "set null" }),
  instructions: text4("instructions").notNull().default(""),
  dailyLimit: integer2("daily_limit").notNull().default(25),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [index4("mailbox_agent_settings_reviewer_idx").on(t.reviewerUserId)]);
var aiUsage = sqliteTable2("ai_usage", {
  id: text4("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  provider: text4("provider").notNull(),
  model: text4("model").notNull(),
  source: text4("source").notNull(),
  inputTokens: integer2("input_tokens"),
  outputTokens: integer2("output_tokens"),
  costUsdMicros: integer2("cost_usd_micros")
}, (t) => [index4("ai_usage_created_idx").on(t.createdAt)]);
var agentConversations = sqliteTable2("agent_conversations", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  title: text4("title").notNull().default("New conversation"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  index4("agent_conversations_owner_idx").on(t.userId, t.mailboxId, t.updatedAt),
  index4("agent_conversations_mailbox_idx").on(t.mailboxId)
]);
var agentChatMessages = sqliteTable2("agent_chat_messages", {
  id: text4("id").primaryKey(),
  conversationId: text4("conversation_id").notNull().references(() => agentConversations.id, { onDelete: "cascade" }),
  role: text4("role", { enum: ["user", "assistant", "tool"] }).notNull(),
  content: text4("content").notNull(),
  toolName: text4("tool_name"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [index4("agent_chat_messages_conversation_idx").on(t.conversationId, t.createdAt)]);
var agentJobs = sqliteTable2("agent_jobs", {
  id: text4("id").primaryKey(),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  sourceMessageId: text4("source_message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  reviewerUserId: text4("reviewer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text4("status", { enum: ["pending", "running", "completed", "skipped", "failed"] }).notNull().default("pending"),
  attempts: integer2("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  leaseUntil: timestamp("lease_until"),
  draftId: text4("draft_id").references(() => messages.id, { onDelete: "set null" }),
  reason: text4("reason"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  uniqueIndex4("agent_jobs_source_idx").on(t.mailboxId, t.sourceMessageId),
  index4("agent_jobs_due_idx").on(t.status, t.nextAttemptAt),
  index4("agent_jobs_source_message_idx").on(t.sourceMessageId),
  index4("agent_jobs_draft_idx").on(t.draftId),
  index4("agent_jobs_reviewer_idx").on(t.reviewerUserId)
]);
var agentDraftMetadata = sqliteTable2("agent_draft_metadata", {
  draftId: text4("draft_id").primaryKey().references(() => messages.id, { onDelete: "cascade" }),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  origin: text4("origin", { enum: ["chat", "auto", "mcp"] }).notNull(),
  sourceMessageId: text4("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  revision: integer2("revision").notNull().default(1),
  humanEditedAt: timestamp("human_edited_at"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  index4("agent_draft_meta_source_msg_idx").on(t.sourceMessageId),
  index4("agent_draft_metadata_mailbox_idx").on(t.mailboxId)
]);
var agentSendApprovals = sqliteTable2("agent_send_approvals", {
  id: text4("id").primaryKey(),
  draftId: text4("draft_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestKeyId: text4("request_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  revision: integer2("revision").notNull(),
  payloadHash: text4("payload_hash").notNull(),
  status: text4("status", { enum: ["pending", "claimed", "sent", "unknown", "expired", "cancelled"] }).notNull().default("pending"),
  claimedAt: timestamp("claimed_at"),
  messageId: text4("message_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  index4("agent_send_approvals_user_idx").on(t.userId, t.status),
  uniqueIndex4("agent_send_approvals_delivery_idx").on(t.draftId).where(sql2`status IN ('claimed', 'sent', 'unknown')`),
  index4("agent_send_approvals_request_key_idx").on(t.requestKeyId),
  index4("agent_send_approvals_mailbox_idx").on(t.mailboxId),
  index4("agent_send_approvals_draft_idx").on(t.draftId)
]);
var mcpKeyMailboxes = sqliteTable2("mcp_key_mailboxes", {
  keyId: text4("key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" })
}, (t) => [
  uniqueIndex4("mcp_key_mailbox_idx").on(t.keyId, t.mailboxId),
  index4("mcp_key_mailboxes_mailbox_idx").on(t.mailboxId)
]);
var driveItems = sqliteTable2("drive_items", {
  id: text4("id").primaryKey(),
  ownerId: text4("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text4("parent_id"),
  kind: text4("kind", { enum: ["file", "folder"] }).notNull(),
  name: text4("name").notNull(),
  r2Key: text4("r2_key"),
  size: integer2("size").notNull().default(0),
  contentType: text4("content_type").notNull().default("application/octet-stream"),
  // Set while a multipart upload is in flight; such rows stay hidden until the upload completes.
  uploadId: text4("upload_id"),
  uploadPartSize: integer2("upload_part_size"),
  uploadFingerprint: text4("upload_fingerprint"),
  linkToken: text4("link_token"),
  trashedAt: timestamp("trashed_at"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  index4("drive_items_owner_parent_idx").on(t.ownerId, t.parentId),
  uniqueIndex4("drive_items_link_token_idx").on(t.linkToken)
]);
var driveUploadParts = sqliteTable2("drive_upload_parts", {
  itemId: text4("item_id").notNull().references(() => driveItems.id, { onDelete: "cascade" }),
  partNumber: integer2("part_number").notNull(),
  etag: text4("etag").notNull()
}, (t) => [uniqueIndex4("drive_upload_parts_idx").on(t.itemId, t.partNumber)]);
var driveShares = sqliteTable2("drive_shares", {
  id: text4("id").primaryKey(),
  itemId: text4("item_id").notNull().references(() => driveItems.id, { onDelete: "cascade" }),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text4("role", { enum: ["view", "edit"] }).notNull().default("view"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date())
}, (t) => [
  uniqueIndex4("drive_shares_item_user_idx").on(t.itemId, t.userId),
  index4("drive_shares_user_idx").on(t.userId)
]);
var importJobs = sqliteTable2("import_jobs", {
  id: text4("id").primaryKey(),
  userId: text4("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mailboxId: text4("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  kind: text4("kind", { enum: ["file", "imap"] }).notNull(),
  label: text4("label").notNull(),
  status: text4("status", { enum: ["queued", "running", "completed", "failed", "cancelled"] }).notNull().default("queued"),
  // Messages known to be part of the job; for IMAP it grows as each source folder is counted.
  total: integer2("total").notNull().default(0),
  processed: integer2("processed").notNull().default(0),
  imported: integer2("imported").notNull().default(0),
  skipped: integer2("skipped").notNull().default(0),
  // What to import (JSON, never credentials) and where the next queue message resumes (JSON).
  spec: text4("spec").notNull(),
  cursor: text4("cursor").notNull().default("{}"),
  // Up to a handful of per-message error strings (JSON array); errorCount is the true total.
  errors: text4("errors").notNull().default("[]"),
  errorCount: integer2("error_count").notNull().default(0),
  error: text4("error"),
  createdAt: timestamp("created_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  startedAt: timestamp("started_at"),
  updatedAt: timestamp("updated_at").notNull().$defaultFn(() => /* @__PURE__ */ new Date()),
  finishedAt: timestamp("finished_at")
}, (t) => [index4("import_jobs_user_idx").on(t.userId, t.createdAt), index4("import_jobs_status_idx").on(t.status, t.updatedAt)]);
var schema = {
  users,
  domains,
  mailboxes,
  mailboxAliases,
  autoReplyDeliveries,
  mailboxAccess,
  contacts,
  folders,
  apiKeys,
  messages,
  spamTokenStats,
  spamReputation,
  spamFeedback,
  messageAttachments,
  sharedAttachmentLinks,
  outboundJobs,
  emailTemplates,
  calendarEvents,
  bookingEvents,
  routingRules,
  webhooks,
  webhookDeliveries,
  sessions,
  pushSubscriptions,
  driveItems,
  driveUploadParts,
  driveShares,
  auditLogs,
  backupSettings,
  backups,
  appSettings,
  licenseSettings,
  mailboxAgentSettings,
  aiUsage,
  agentConversations,
  agentChatMessages,
  agentJobs,
  agentDraftMetadata,
  agentSendApprovals,
  mcpKeyMailboxes,
  importJobs
};

// src/db/external.ts
import { drizzle as mysqlProxy } from "drizzle-orm/mysql-proxy";
import { drizzle as pgProxy } from "drizzle-orm/pg-proxy";
import { drizzle as sqliteProxy } from "drizzle-orm/sqlite-proxy";

// src/db/compat.ts
import { getTableColumns, inArray, sql as sql3 } from "drizzle-orm";
var currentExecutor = (ctx) => ctx.tx ?? ctx.base;
async function runRaw(db, ctx, query, mode) {
  const { sql: text5, params: params3 } = db.dialect.sqlToQuery(query);
  return currentExecutor(ctx).query(text5, params3, mode);
}
function wrapDatabase(db, dialect, ctx) {
  const raw = db;
  const batch = async (queries) => {
    const runAll = async () => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    };
    const { base } = ctx;
    if (!base.transaction || ctx.tx) return runAll();
    return base.transaction(async (tx) => {
      ctx.tx = tx;
      try {
        return await runAll();
      } finally {
        ctx.tx = null;
      }
    });
  };
  const overrides = {
    async all(query) {
      return (await runRaw(raw, ctx, query, "object")).rows;
    },
    async get(query) {
      return (await runRaw(raw, ctx, query, "object")).rows[0];
    },
    async values(query) {
      return (await runRaw(raw, ctx, query, "array")).rows;
    },
    async run(query) {
      const result = await runRaw(raw, ctx, query, "object");
      return {
        success: true,
        results: result.rows,
        meta: { changes: result.affectedRows, last_row_id: result.insertId ?? 0, rows_written: result.affectedRows, changed_db: result.affectedRows > 0 }
      };
    },
    batch
  };
  if (dialect === "mysql") {
    overrides.insert = (table) => new MysqlInsertShim(raw, table);
    overrides.update = (table) => new MysqlUpdateShim(raw, table);
    overrides.delete = (table) => new MysqlDeleteShim(raw, table);
  }
  return new Proxy(db, {
    get(target, property) {
      if (typeof property === "string" && property in overrides) return overrides[property];
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function affectedRows(result) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number(header?.affectedRows ?? 0);
}
function insertId(result) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number(header?.insertId ?? 0);
}
function primaryKey(table) {
  const columns = Object.values(getTableColumns(table));
  const key = columns.find((column) => column.primary);
  if (!key) throw new Error("Emulating RETURNING on MySQL needs a single-column primary key.");
  const entry = Object.entries(getTableColumns(table)).find(([, column]) => column === key);
  return { column: key, property: entry?.[0] ?? "id", autoIncrement: !!key.autoIncrement };
}
async function selectByKeys(db, table, fields, keys) {
  if (keys.length === 0) return [];
  const { column } = primaryKey(table);
  const query = fields ? db.select(fields) : db.select();
  return query.from(table).where(inArray(column, keys));
}
var MysqlInsertShim = class {
  constructor(db, table) {
    this.db = db;
    this.table = table;
  }
  db;
  table;
  rows = [];
  conflict = null;
  returningFields;
  wantsReturning = false;
  values(values) {
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }
  onConflictDoNothing() {
    this.conflict = {};
    return this;
  }
  onConflictDoUpdate(config) {
    this.conflict = { set: config.set };
    return this;
  }
  returning(fields) {
    this.wantsReturning = true;
    this.returningFields = fields;
    return this;
  }
  async execute() {
    const statement = this.db.insert(this.table).values(this.rows.length === 1 ? this.rows[0] : this.rows);
    const key = this.wantsReturning ? primaryKey(this.table) : null;
    const existing = key && this.conflict && !this.conflict.set ? new Set((await selectByKeys(this.db, this.table, { key: key.column }, this.keysOf(key, null))).map((row) => row.key)) : /* @__PURE__ */ new Set();
    let result;
    if (this.conflict) {
      const [property, column] = Object.entries(getTableColumns(this.table))[0];
      result = await statement.onDuplicateKeyUpdate({ set: this.conflict.set ?? { [property]: sql3`${column}` } });
    } else {
      result = await statement;
    }
    if (!key) return result;
    const keys = this.keysOf(key, result).filter((value) => !existing.has(value));
    return selectByKeys(this.db, this.table, this.returningFields, keys);
  }
  keysOf(key, result) {
    if (key.autoIncrement && result) return this.rows.map((_, i) => insertId(result) + i);
    return this.rows.map((row) => row[key.property]).filter((value) => value !== void 0);
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
};
var MysqlUpdateShim = class {
  constructor(db, table) {
    this.db = db;
    this.table = table;
  }
  db;
  table;
  values = {};
  condition;
  returningFields;
  wantsReturning = false;
  set(values) {
    this.values = values;
    return this;
  }
  where(condition) {
    this.condition = condition;
    return this;
  }
  returning(fields) {
    this.wantsReturning = true;
    this.returningFields = fields;
    return this;
  }
  async execute() {
    const { column } = primaryKey(this.table);
    const before = this.wantsReturning ? await this.db.select({ key: column }).from(this.table).where(this.condition) : [];
    const result = await this.db.update(this.table).set(this.values).where(this.condition);
    if (!this.wantsReturning) return result;
    if (affectedRows(result) === 0) return [];
    return selectByKeys(this.db, this.table, this.returningFields, before.map((row) => row.key));
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
};
var MysqlDeleteShim = class {
  constructor(db, table) {
    this.db = db;
    this.table = table;
  }
  db;
  table;
  condition;
  returningFields;
  wantsReturning = false;
  where(condition) {
    this.condition = condition;
    return this;
  }
  returning(fields) {
    this.wantsReturning = true;
    this.returningFields = fields;
    return this;
  }
  async execute() {
    if (!this.wantsReturning) return this.db.delete(this.table).where(this.condition);
    const query = this.returningFields ? this.db.select(this.returningFields) : this.db.select();
    const before = await query.from(this.table).where(this.condition);
    const result = await this.db.delete(this.table).where(this.condition);
    return affectedRows(result) === 0 ? [] : before;
  }
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
};

// src/db/drivers/types.ts
function numberPlaceholders(sql4) {
  let out = "";
  let index5 = 0;
  let i = 0;
  while (i < sql4.length) {
    const ch = sql4[i];
    if (ch === "'" || ch === '"') {
      const end = sql4.indexOf(ch, i + 1);
      let close = end;
      while (close !== -1 && sql4[close + 1] === ch) close = sql4.indexOf(ch, close + 2);
      const stop = close === -1 ? sql4.length : close + 1;
      out += sql4.slice(i, stop);
      i = stop;
    } else if (ch === "-" && sql4[i + 1] === "-") {
      const end = sql4.indexOf("\n", i);
      const stop = end === -1 ? sql4.length : end;
      out += sql4.slice(i, stop);
      i = stop;
    } else if (ch === "?") {
      out += `$${++index5}`;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}
function normalizeParam(value) {
  if (value === void 0) return null;
  if (value instanceof Date) return Math.floor(value.getTime() / 1e3);
  if (ArrayBuffer.isView(value) && !(value instanceof Uint8Array)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}
function lazyExecutor(dialect, open) {
  let pending;
  const ready = () => pending ??= open().catch((error) => {
    pending = void 0;
    throw error;
  });
  return {
    dialect,
    query: async (sql4, params3, mode) => (await ready()).query(sql4, params3, mode),
    transaction: async (fn) => {
      const inner = await ready();
      if (!inner.transaction) return fn(inner);
      return inner.transaction(fn);
    },
    close: async () => {
      if (pending) await (await pending).close?.();
      pending = void 0;
    }
  };
}

// src/db/d1-compat.ts
function meta(affectedRows2, insertId2) {
  return { duration: 0, size_after: 0, rows_read: 0, rows_written: affectedRows2, last_row_id: insertId2 ?? 0, changed_db: affectedRows2 > 0, changes: affectedRows2 };
}
var CompatStatement = class _CompatStatement {
  constructor(db, sql4, params3 = []) {
    this.db = db;
    this.sql = sql4;
    this.params = params3;
  }
  db;
  sql;
  params;
  bind(...values) {
    return new _CompatStatement(this.db, this.sql, values.map(normalizeParam));
  }
  /** Statements without parameters (migrations) are sent untouched, so a `?` inside a function body survives. */
  text() {
    return this.db.dialect === "postgres" && this.params.length > 0 ? numberPlaceholders(this.sql) : this.sql;
  }
  /** @internal */
  async execute(executor) {
    return executor.query(this.text(), this.params, "object");
  }
  async run() {
    const result = await this.execute(this.db.executor());
    return { results: result.rows, success: true, meta: meta(result.affectedRows, result.insertId) };
  }
  async all() {
    return this.run();
  }
  async first(column) {
    const result = await this.execute(this.db.executor());
    const row = result.rows[0];
    if (!row) return null;
    return column ? row[column] : row;
  }
  async raw() {
    return (await this.db.executor().query(this.text(), this.params, "array")).rows;
  }
};
var CompatDatabase = class {
  constructor(dialect, base, active = () => null) {
    this.dialect = dialect;
    this.base = base;
    this.active = active;
  }
  dialect;
  base;
  active;
  executor() {
    return this.active() ?? this.base;
  }
  prepare(sql4) {
    return new CompatStatement(this, sql4);
  }
  async batch(statements) {
    const run = async (executor) => {
      const results = [];
      for (const statement of statements) {
        const result = await statement.execute(executor);
        results.push({ results: result.rows, success: true, meta: meta(result.affectedRows, result.insertId) });
      }
      return results;
    };
    return this.base.transaction ? this.base.transaction(run) : run(this.base);
  }
  async exec(sql4) {
    const result = await this.base.query(sql4, [], "object");
    return { count: 1, duration: 0, rows: result.rows };
  }
  async dump() {
    throw new Error("dump() is not available on external databases.");
  }
};

// src/db/drivers/mysql.ts
var params = (values) => values.map(normalizeParam);
function sslFor(url) {
  return /tidbcloud\.com|[?&]ssl(mode)?=(true|required|require|verify)/i.test(url) ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : void 0;
}
function mysqlExecutor(queryable, transaction) {
  return {
    dialect: "mysql",
    async query(sql4, values, mode) {
      const [result] = await queryable.query({ sql: sql4, rowsAsArray: mode === "array" }, params(values));
      if (Array.isArray(result)) return { rows: result, affectedRows: result.length };
      const header = result;
      return { rows: [], affectedRows: header.affectedRows ?? 0, insertId: header.insertId };
    },
    transaction
  };
}
function openMysql2({ url, shared }) {
  return lazyExecutor("mysql", async () => {
    const mysql2 = await import("./promise-ZLSANNDV.mjs");
    const lib = mysql2.default ?? mysql2;
    const options = {
      uri: url.replace(/^mysql2:/i, "mysql:").replace(/^mariadb:/i, "mysql:"),
      ssl: sslFor(url),
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
      charset: "utf8mb4",
      timezone: "Z"
    };
    const inTransaction = async (connection, fn) => {
      await connection.beginTransaction();
      try {
        const result = await fn(mysqlExecutor(connection));
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback().catch(() => void 0);
        throw error;
      }
    };
    if (shared) {
      const pool = lib.createPool({ ...options, connectionLimit: 10 });
      return {
        ...mysqlExecutor(pool, async (fn) => {
          const connection = await pool.getConnection();
          try {
            return await inTransaction(connection, fn);
          } finally {
            connection.release();
          }
        }),
        close: () => pool.end()
      };
    }
    const withConnection = async (fn) => {
      const connection = await lib.createConnection(options);
      try {
        return await fn(connection);
      } finally {
        await connection.end().catch(() => void 0);
      }
    };
    return {
      dialect: "mysql",
      query: (sql4, values, mode) => withConnection((connection) => mysqlExecutor(connection).query(sql4, values, mode)),
      transaction: (fn) => withConnection((connection) => inTransaction(connection, fn))
    };
  });
}
function openPlanetScale({ url }) {
  return lazyExecutor("mysql", async () => {
    const { connect } = await import("./dist-3SJ2JIDO.mjs");
    const cast = (field, value) => {
      if (value === null) return null;
      if (/^(INT|UINT|YEAR|DECIMAL|FLOAT|DOUBLE)/.test(field.type)) return Number(value);
      return value;
    };
    const connection = connect({ url: url.replace(/^mysql2?:/i, "https:").replace(/^(https:\/\/[^@]*@)/, "$1"), cast });
    const executorFor = (target, transaction) => ({
      dialect: "mysql",
      async query(sql4, values, mode) {
        const result = await target.execute(sql4, params(values), { as: mode === "array" ? "array" : "object" });
        return { rows: result.rows, affectedRows: result.rowsAffected, insertId: result.insertId ? Number(result.insertId) : void 0 };
      },
      transaction
    });
    return executorFor(connection, (fn) => connection.transaction((tx) => fn(executorFor(tx))));
  });
}

// src/db/drivers/postgres.ts
var INT8 = 20;
var NUMERIC = 1700;
function params2(values) {
  return values.map(normalizeParam);
}
function pgExecutor(queryable, types, inTransaction) {
  return {
    dialect: "postgres",
    async query(text5, values, mode) {
      const result = await queryable.query({ text: text5, values: params2(values), rowMode: mode === "array" ? "array" : void 0, types });
      return { rows: result.rows, affectedRows: result.rowCount ?? 0 };
    },
    transaction: inTransaction
  };
}
function openNodePostgres({ url, shared }) {
  return lazyExecutor("postgres", async () => {
    const pg2 = await import("./esm-KYHR7CW6.mjs");
    const { Pool, Client, types: pgTypes } = pg2.default ?? pg2;
    const types = {
      getTypeParser: (oid, format) => oid === INT8 || oid === NUMERIC ? (value) => Number(value) : pgTypes.getTypeParser(oid, format)
    };
    const config = { connectionString: url };
    if (shared) {
      const pool = new Pool({ ...config, max: 10 });
      pool.on("error", (error) => console.error("Postgres pool error:", error.message));
      const run = async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(pgExecutor(client, types));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => void 0);
          throw error;
        } finally {
          client.release();
        }
      };
      return { ...pgExecutor(pool, types, run), close: () => pool.end() };
    }
    const withClient = async (fn) => {
      const client = new Client({ ...config, connectionTimeoutMillis: 1e4 });
      await client.connect();
      try {
        return await fn(client);
      } finally {
        await client.end().catch(() => void 0);
      }
    };
    return {
      dialect: "postgres",
      query: (text5, values, mode) => withClient((client) => pgExecutor(client, types).query(text5, values, mode)),
      transaction: (fn) => withClient(async (client) => {
        await client.query("BEGIN");
        try {
          const result = await fn(pgExecutor(client, types));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => void 0);
          throw error;
        }
      })
    };
  });
}
function openPostgresJs({ url, shared }) {
  return lazyExecutor("postgres", async () => {
    const imported = await import("./src-D53HPEE4.mjs");
    const postgres = imported.default;
    const make = () => postgres(url, {
      max: shared ? 10 : 1,
      prepare: false,
      onnotice: () => void 0,
      types: {
        bigint: { to: INT8, from: [INT8], serialize: (value) => String(value), parse: (value) => Number(value) },
        numeric: { to: NUMERIC, from: [NUMERIC], serialize: (value) => String(value), parse: (value) => Number(value) }
      }
    });
    const executorFor = (sql4, transaction) => ({
      dialect: "postgres",
      async query(text5, values, mode) {
        const statement = sql4.unsafe(text5, params2(values));
        if (mode === "array") {
          const result2 = await statement.values();
          return { rows: result2, affectedRows: result2.count ?? result2.length };
        }
        const result = await statement;
        return { rows: [...result], affectedRows: result.count ?? result.length };
      },
      transaction
    });
    if (shared) {
      const sql4 = make();
      return {
        ...executorFor(sql4, (fn) => sql4.begin((tx) => fn(executorFor(tx)))),
        close: () => sql4.end()
      };
    }
    return {
      dialect: "postgres",
      query: async (text5, values, mode) => {
        const sql4 = make();
        try {
          return await executorFor(sql4).query(text5, values, mode);
        } finally {
          await sql4.end({ timeout: 1 }).catch(() => void 0);
        }
      },
      transaction: async (fn) => {
        const sql4 = make();
        try {
          return await sql4.begin((tx) => fn(executorFor(tx)));
        } finally {
          await sql4.end({ timeout: 1 }).catch(() => void 0);
        }
      }
    };
  });
}
function openNeon({ url }) {
  return lazyExecutor("postgres", async () => {
    const { neon } = await import("./serverless-2A4GBK3Q.mjs");
    const sql4 = neon(url, { fullResults: true });
    return {
      dialect: "postgres",
      async query(text5, values, mode) {
        const result = await sql4.query(text5, params2(values), { arrayMode: mode === "array", fullResults: true });
        const numeric = result.fields.map((field, index5) => field.dataTypeID === INT8 || field.dataTypeID === NUMERIC ? [index5, field.name] : null).filter((entry) => entry !== null);
        if (numeric.length > 0) {
          for (const row of result.rows) {
            for (const [index5, name] of numeric) {
              const cell = mode === "array" ? row[index5] : row[name];
              if (typeof cell !== "string") continue;
              if (mode === "array") row[index5] = Number(cell);
              else row[name] = Number(cell);
            }
          }
        }
        return { rows: result.rows, affectedRows: result.rowCount ?? 0 };
      }
      // The HTTP protocol has no interactive transaction; batches fall back to sequential statements.
    };
  });
}
function openPglite({ url }) {
  return lazyExecutor("postgres", async () => {
    const name = "@electric-sql/pglite";
    const { PGlite } = await import(
      /* @vite-ignore */
      name
    );
    const location = url.replace(/^pglite:(\/\/)?/i, "");
    const dataDir = !location || location === "memory" || location === "memory:" ? void 0 : location;
    const db = await PGlite.create(dataDir, { parsers: { [INT8]: (value) => Number(value), [NUMERIC]: (value) => Number(value) } });
    const executorFor = (target, transaction) => ({
      dialect: "postgres",
      async query(text5, values, mode) {
        const result = await target.query(text5, params2(values), { rowMode: mode === "array" ? "array" : "object" });
        return { rows: result.rows, affectedRows: result.affectedRows ?? result.rows.length };
      },
      transaction
    });
    return { ...executorFor(db, (fn) => db.transaction((tx) => fn(executorFor(tx)))), close: () => db.close() };
  });
}

// src/db/drivers/sqlite.ts
var sqliteParam = (value) => {
  const normalized = normalizeParam(value);
  return typeof normalized === "boolean" ? normalized ? 1 : 0 : normalized;
};
function openLibsql({ url, authToken }) {
  return lazyExecutor("sqlite", async () => {
    const { createClient } = await import("./node-5FFF23ZM.mjs");
    const client = createClient({ url, authToken });
    const executorFor = (target, transaction) => ({
      dialect: "sqlite",
      async query(sql4, values, mode) {
        const result = await target.execute({ sql: sql4, args: values.map(sqliteParam) });
        const rows = mode === "array" ? result.rows.map((row) => result.columns.map((_, i) => row[i])) : result.rows.map((row) => ({ ...row }));
        return { rows, affectedRows: result.rowsAffected, insertId: result.lastInsertRowid === void 0 ? void 0 : Number(result.lastInsertRowid) };
      },
      transaction
    });
    return {
      ...executorFor(client, async (fn) => {
        const tx = await client.transaction("write");
        try {
          const result = await fn(executorFor(tx));
          await tx.commit();
          return result;
        } catch (error) {
          await tx.rollback().catch(() => void 0);
          throw error;
        } finally {
          tx.close();
        }
      }),
      close: async () => client.close()
    };
  });
}
function openBetterSqlite3({ url }) {
  return lazyExecutor("sqlite", async () => {
    const name = "better-sqlite3";
    const Database = (await import(
      /* @vite-ignore */
      name
    )).default;
    const path = url.replace(/^(file|sqlite):(\/\/)?/i, "") || ":memory:";
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return syncSqliteExecutor((sql4, values, mode) => {
      const statement = db.prepare(sql4);
      if (statement.reader) {
        const rows = mode === "array" ? statement.raw(true).all(...values) : statement.raw(false).all(...values);
        return { rows, affectedRows: 0 };
      }
      const info = statement.run(...values);
      return { rows: [], affectedRows: info.changes, insertId: Number(info.lastInsertRowid) };
    }, async () => void db.close());
  });
}
function openBunSqlite({ url }) {
  return lazyExecutor("sqlite", async () => {
    const name = "bun:sqlite";
    const { Database } = await import(
      /* @vite-ignore */
      name
    );
    const db = new Database(url.replace(/^(file|sqlite):(\/\/)?/i, "") || ":memory:");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    return syncSqliteExecutor((sql4, values, mode) => {
      const statement = db.query(sql4);
      if (statement.columnNames.length > 0) {
        return { rows: mode === "array" ? statement.values(...values) : statement.all(...values), affectedRows: 0 };
      }
      const info = statement.run(...values);
      return { rows: [], affectedRows: info.changes, insertId: Number(info.lastInsertRowid) };
    }, async () => db.close());
  });
}
function syncSqliteExecutor(run, close) {
  let chain = Promise.resolve();
  const executor = {
    dialect: "sqlite",
    async query(sql4, values, mode) {
      return run(sql4, values.map(sqliteParam), mode);
    },
    // One connection means one transaction at a time; later callers wait for the earlier to finish.
    transaction(fn) {
      const result = chain.then(async () => {
        run("BEGIN", [], "array");
        try {
          const value = await fn(executor);
          run("COMMIT", [], "array");
          return value;
        } catch (error) {
          run("ROLLBACK", [], "array");
          throw error;
        }
      });
      chain = result.catch(() => void 0);
      return result;
    },
    close
  };
  return executor;
}

// src/db/external.ts
function openExecutor(config, shared) {
  const options = { url: config.url ?? "", authToken: config.authToken, shared };
  switch (config.driver) {
    case "node-postgres":
      return openNodePostgres(options);
    case "postgres-js":
      return openPostgresJs(options);
    case "neon":
      return openNeon(options);
    case "pglite":
      return openPglite(options);
    case "mysql2":
      return openMysql2(options);
    case "planetscale":
      return openPlanetScale(options);
    case "libsql":
      return openLibsql(options);
    case "better-sqlite3":
      return openBetterSqlite3(options);
    case "bun-sqlite":
      return openBunSqlite(options);
    default:
      throw new Error(`No executor for database driver "${config.driver}".`);
  }
}
function withAffected(rows, affectedRows2) {
  Object.defineProperty(rows, "affectedRows", { value: affectedRows2, enumerable: false });
  return rows;
}
function buildDrizzle(config, ctx, schema2) {
  const executor = () => currentExecutor(ctx);
  if (config.dialect === "postgres") {
    const db2 = pgProxy(
      async (sql4, params3, method) => {
        const result = await executor().query(sql4, params3, method === "all" ? "array" : "object");
        return { rows: withAffected(result.rows, result.affectedRows) };
      },
      { schema: schema2 }
    );
    return wrapDatabase(db2, "postgres", ctx);
  }
  if (config.dialect === "mysql") {
    const db2 = mysqlProxy(
      async (sql4, params3, method) => {
        const result = await executor().query(sql4, params3, method === "all" ? "array" : "object");
        if (method === "all") return { rows: result.rows };
        return { rows: [{ insertId: result.insertId ?? 0, affectedRows: result.affectedRows }], insertId: result.insertId, affectedRows: result.affectedRows };
      },
      { schema: schema2 }
    );
    return wrapDatabase(db2, "mysql", ctx);
  }
  const db = sqliteProxy(
    async (sql4, params3, method) => {
      const result = await executor().query(sql4, params3, "array");
      if (method === "run") return { rows: [] };
      if (method === "get") return { rows: result.rows[0] };
      return { rows: result.rows };
    },
    async (queries) => {
      const run = async (exec) => {
        const out = [];
        for (const query of queries) {
          const result = await exec.query(query.sql, query.params, "array");
          out.push({ rows: query.method === "get" ? result.rows[0] : result.rows });
        }
        return out;
      };
      return ctx.base.transaction ? ctx.base.transaction(run) : run(ctx.base);
    },
    { schema: schema2 }
  );
  return wrapDatabase(db, "sqlite", ctx);
}
function openExternalDatabase(config, shared) {
  const base = openExecutor(config, shared);
  const ctx = { base, tx: null };
  const compat = new CompatDatabase(config.dialect, base, () => ctx.tx);
  Object.defineProperties(compat, {
    config: { value: config },
    sqlExecutor: { value: base },
    createDrizzle: {
      value: (schema2) => buildDrizzle(config, { base, tx: null }, schema2)
    }
  });
  return compat;
}
function isExternalDatabase(value) {
  return !!value && typeof value.createDrizzle === "function";
}

// src/db/index.ts
function createD1Db(d1) {
  return drizzle(d1, { schema });
}
function createDb(d1) {
  if (isExternalDatabase(d1)) return d1.createDrizzle(schema);
  return createD1Db(d1);
}
function getDb(env) {
  if (!env.DB) {
    throw new Error("No database binding configured");
  }
  return createDb(env.DB);
}

export {
  resolveDatabaseConfig,
  schemaDialect,
  users,
  domains,
  mailboxes,
  mailboxAliases,
  mailboxAccess,
  contacts,
  folders,
  jmapChanges,
  jmapChangeFloor,
  messages,
  messageAttachments,
  sharedAttachmentLinks,
  outboundJobs,
  messageTracking,
  domainTrackingHosts,
  userComposePreferences,
  followUps,
  webhooks,
  webhookDeliveries,
  auditLogs,
  appSettings,
  licenseSettings,
  schema,
  openExternalDatabase,
  createDb,
  getDb
};
