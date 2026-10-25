import "./chunk-UV2HVMKZ.mjs";

// node_modules/@planetscale/database/dist/text.js
var decoder = new TextDecoder("utf-8");
function decodeUtf8(text) {
  return text ? decoder.decode(uint8Array(text)) : "";
}
function hex(text) {
  const digits = bytes(text).map((b) => b.toString(16).padStart(2, "0"));
  return `0x${digits.join("")}`;
}
function uint8Array(text) {
  return Uint8Array.from(bytes(text));
}
function bytes(text) {
  return text.split("").map((c) => c.charCodeAt(0));
}

// node_modules/@planetscale/database/dist/cast.js
function cast(field, value) {
  if (value == null) {
    return value;
  }
  if (isBigInt(field)) {
    return value;
  }
  if (isDateOrTime(field)) {
    return value;
  }
  if (isDecimal(field)) {
    return value;
  }
  if (isJson(field)) {
    return JSON.parse(decodeUtf8(value));
  }
  if (isIntegral(field)) {
    return parseInt(value, 10);
  }
  if (isFloat(field)) {
    return parseFloat(value);
  }
  if (isBinary(field)) {
    return uint8Array(value);
  }
  return decodeUtf8(value);
}
var BIG_INT_FIELD_TYPES = ["INT64", "UINT64"];
function isBigInt(field) {
  return BIG_INT_FIELD_TYPES.includes(field.type);
}
var DATE_OR_DATETIME_FIELD_TYPES = ["DATETIME", "DATE", "TIMESTAMP", "TIME"];
function isDateOrTime(field) {
  return DATE_OR_DATETIME_FIELD_TYPES.includes(field.type);
}
function isDecimal(field) {
  return field.type === "DECIMAL";
}
function isJson(field) {
  return field.type === "JSON";
}
var INTEGRAL_FIELD_TYPES = ["INT8", "INT16", "INT24", "INT32", "UINT8", "UINT16", "UINT24", "UINT32", "YEAR"];
function isIntegral(field) {
  return INTEGRAL_FIELD_TYPES.includes(field.type);
}
var FLOAT_FIELD_TYPES = ["FLOAT32", "FLOAT64"];
function isFloat(field) {
  return FLOAT_FIELD_TYPES.includes(field.type);
}
var BinaryId = 63;
function isBinary(field) {
  return field.charset === BinaryId;
}

// node_modules/@planetscale/database/dist/version.js
var Version = "2.0.0";

// node_modules/@planetscale/database/dist/index.js
var isCloudflareWorker = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
var DatabaseError = class extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.name = "DatabaseError";
    this.body = body;
  }
};
var UnknownError = class extends DatabaseError {
  constructor(message, context) {
    super(message, context.status, { code: "UNKNOWN", message });
    this.name = "UnknownError";
    this.context = context;
  }
};
var Client = class {
  constructor(config) {
    this.config = config;
  }
  async transaction(fn) {
    return this.connection().transaction(fn);
  }
  async execute(query, options, ...unsupported) {
    options = executeOptions(options, unsupported);
    return this.connection().execute(query, options);
  }
  connection() {
    return new Connection(this.config);
  }
};
var Tx = class {
  constructor(conn) {
    this.conn = conn;
  }
  async execute(query, options, ...unsupported) {
    options = executeOptions(options, unsupported);
    return this.conn.execute(query, options);
  }
};
var optionKeys = ["as", "cast"];
function executeOptions(options, unsupported) {
  if (options == null) {
    options = {};
  }
  const isOptions = typeof options === "object" && !Array.isArray(options) && Object.keys(options).every((key) => optionKeys.includes(key));
  if (unsupported.length > 0 || !isOptions) {
    throw new Error("Query parameters are not supported: pass a complete SQL string and options to execute(query, options)");
  }
  return options;
}
function protocol(protocol2) {
  return protocol2 === "http:" ? protocol2 : "https:";
}
function buildURL(url) {
  const scheme = `${protocol(url.protocol)}//`;
  return new URL(url.pathname, `${scheme}${url.host}`).toString();
}
var Connection = class _Connection {
  constructor(config) {
    this.config = config;
    this.fetch = config.fetch || fetch;
    this.session = null;
    if (config.url) {
      const url = new URL(config.url);
      this.config.username = url.username;
      this.config.password = url.password;
      this.config.host = url.hostname;
      this.url = buildURL(url);
    } else {
      this.url = new URL(`https://${this.config.host}`).toString();
    }
  }
  async transaction(fn) {
    const conn = new _Connection(this.config);
    const tx = new Tx(conn);
    try {
      await tx.execute("BEGIN");
      const res = await fn(tx);
      await tx.execute("COMMIT");
      return res;
    } catch (err) {
      await tx.execute("ROLLBACK");
      throw err;
    }
  }
  async refresh() {
    await this.createSession();
  }
  async execute(query, options, ...unsupported) {
    options = executeOptions(options, unsupported);
    const url = new URL("/psdb.v1alpha1.Database/Execute", this.url);
    const saved = await postJSON(this.config, this.fetch, url, {
      query,
      session: this.session
    });
    const { result, session, error, timing } = saved;
    if (session) {
      this.session = session;
    }
    if (error) {
      throw new DatabaseError(error.message, 400, error);
    }
    const rowsAffected = result?.rowsAffected ? parseInt(result.rowsAffected, 10) : 0;
    const insertId = result?.insertId ?? "0";
    const fields = result?.fields ?? [];
    for (const field of fields) {
      field.type || (field.type = "NULL");
    }
    const castFn = options.cast || this.config.cast || cast;
    const rows = result ? parse(result, castFn, options.as || "object") : [];
    const headers = fields.map((f) => f.name);
    const typeByName = (acc, { name, type }) => ({ ...acc, [name]: type });
    const types = fields.reduce(typeByName, {});
    const timingSeconds = timing ?? 0;
    return {
      headers,
      types,
      fields,
      rows,
      rowsAffected,
      insertId,
      size: rows.length,
      statement: query,
      time: timingSeconds * 1e3
    };
  }
  async createSession() {
    const url = new URL("/psdb.v1alpha1.Database/CreateSession", this.url);
    const { session } = await postJSON(this.config, this.fetch, url);
    this.session = session;
    return session;
  }
};
async function postJSON(config, fetch2, url, body = {}) {
  const auth = btoa(`${config.username}:${config.password}`);
  const response = await fetch2(url.toString(), {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `database-js/${Version}`,
      Authorization: `Basic ${auth}`
    },
    cache: "no-store"
  });
  const text = await response.text();
  if (response.ok) {
    return JSON.parse(text);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
  }
  if (parsed?.error) {
    throw new DatabaseError(parsed.error.message, response.status, parsed.error);
  }
  const headers = {};
  try {
    response.headers?.forEach((value, key) => {
      headers[key] = value;
    });
  } catch {
  }
  const context = {
    status: response.status,
    statusText: response.statusText,
    body: text.substring(0, 4096),
    headers
  };
  const isCloudflareStatusCode = response.status >= 520 && response.status <= 530;
  const isCloudflareError = isCloudflareStatusCode || isCloudflareWorker;
  const status = response.statusText ? `${response.status} ${response.statusText}` : `${response.status}`;
  const message = isCloudflareError ? `Cloudflare error: HTTP ${status} (not a database error)` : `Expected JSON response from database API, got HTTP ${status}`;
  throw new UnknownError(message, context);
}
function connect(config) {
  return new Connection(config);
}
function parseArrayRow(fields, rawRow, cast2) {
  const row = decodeRow(rawRow);
  return fields.map((field, ix) => {
    return cast2(field, row[ix]);
  });
}
function parseObjectRow(fields, rawRow, cast2) {
  const row = decodeRow(rawRow);
  return fields.reduce((acc, field, ix) => {
    acc[field.name] = cast2(field, row[ix]);
    return acc;
  }, {});
}
function parse(result, cast2, returnAs) {
  const fields = result.fields ?? [];
  const rows = result.rows ?? [];
  return rows.map((row) => returnAs === "array" ? parseArrayRow(fields, row, cast2) : parseObjectRow(fields, row, cast2));
}
function decodeRow(row) {
  const values = row.values ? atob(row.values) : "";
  let offset = 0;
  return row.lengths.map((size) => {
    const width = parseInt(size, 10);
    if (width < 0)
      return null;
    const splice = values.substring(offset, offset + width);
    offset += width;
    return splice;
  });
}
export {
  Client,
  Connection,
  DatabaseError,
  UnknownError,
  cast,
  connect,
  hex
};
