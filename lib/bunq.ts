import { createSign, generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BunqContact, RequestStatus } from "@/types";
import { DEMO_CONTACTS } from "@/lib/contacts";

const SANDBOX_BASE = "https://public-api.sandbox.bunq.com";
const PRODUCTION_BASE = "https://api.bunq.com";

// In sandbox, requests to this email are auto-accepted immediately
const SANDBOX_SUGAR_DADDY = "sugardaddy@bunq.com";

const SESSION_FILE = path.join(process.cwd(), ".bunq-session.json");

interface SessionData {
  apiKey: string;          // stored so auto-created sandbox keys survive restarts
  token: string;
  userId: number;
  accountId: number;
  privateKey: string;
  installationToken: string;
}

let sessionCache: SessionData | null = null;

// Circuit breaker — stop hammering bunq after a failure
let authFailedAt: number | null = null;
const AUTH_RETRY_COOLDOWN_MS = 6 * 60 * 1000; // 6 min (bunq asks for 5)

const MOCK_CONTACTS: BunqContact[] = DEMO_CONTACTS.map((c, i) => ({
  id: String(i + 1),
  name: c.name,
  aliases: [{ type: "PHONE_NUMBER", value: c.phone }],
  matched: true,
}));

function isSandbox(): boolean {
  return process.env.BUNQ_ENVIRONMENT !== "production";
}

function getBaseUrl(): string {
  return isSandbox() ? SANDBOX_BASE : PRODUCTION_BASE;
}

// ── Session persistence ──────────────────────────────────────────────────────

function loadPersistedSession(): SessionData | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8")) as SessionData;
  } catch {
    return null;
  }
}

function persistSession(session: SessionData): void {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist bunq session:", err);
  }
}

function clearPersistedSession(): void {
  try { if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE); } catch {}
  sessionCache = null;
}

// ── Crypto helpers ───────────────────────────────────────────────────────────

function generateKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding:  { type: "spki",  format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function signData(data: string, privateKeyPem: string): string {
  const sign = createSign("SHA256");
  sign.update(data);
  return sign.sign(privateKeyPem, "base64");
}

function buildSignatureString(
  method: string,
  urlPath: string,
  headers: Record<string, string>,
  body: string
): string {
  const toSign = [
    "X-Bunq-Client-Authentication",
    "X-Bunq-Client-Request-Id",
    "X-Bunq-Geolocation",
    "X-Bunq-Language",
    "X-Bunq-Region",
  ];
  const headerLines = toSign
    .filter((h) => headers[h])
    .map((h) => `${h}: ${headers[h]}`)
    .join("\n");
  return `${method} ${urlPath}\n${headerLines}\n\n${body}`;
}

function makeRequestId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ── Raw HTTP ─────────────────────────────────────────────────────────────────

async function bunqRequest(
  method: string,
  urlPath: string,
  body: object | null,
  authToken: string | null,
  privateKey: string | null
): Promise<unknown> {
  const requestId = makeRequestId();
  const bodyStr = body ? JSON.stringify(body) : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bunq-Client-Request-Id": requestId,
    "X-Bunq-Geolocation": "0 0 0 0 NL",
    "X-Bunq-Language": "en_US",
    "X-Bunq-Region": "en_US",
    "Cache-Control": "no-cache",
  };

  if (authToken) headers["X-Bunq-Client-Authentication"] = authToken;
  if (privateKey) {
    headers["X-Bunq-Client-Signature"] = signData(
      buildSignatureString(method, urlPath, headers, bodyStr),
      privateKey
    );
  }

  const res = await fetch(`${getBaseUrl()}${urlPath}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`bunq API ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Sandbox user auto-provisioning ───────────────────────────────────────────

async function createSandboxUser(): Promise<string> {
  console.log("No BUNQ_API_KEY set — auto-creating a sandbox user...");
  const res = await fetch(`${SANDBOX_BASE}/v1/sandbox-user-person`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bunq-Client-Request-Id": makeRequestId(),
      "X-Bunq-Geolocation": "0 0 0 0 NL",
      "X-Bunq-Language": "en_US",
      "X-Bunq-Region": "en_US",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`Failed to create sandbox user: ${await res.text()}`);
  const data = (await res.json()) as { Response: Array<{ ApiKey?: { api_key: string } }> };
  const key = data.Response.find((r) => r.ApiKey)?.ApiKey?.api_key;
  if (!key) throw new Error("No API key returned from sandbox-user-person");
  console.log(`  Sandbox user created — API key: ${key.slice(0, 12)}...`);
  return key;
}

// ── Authentication ────────────────────────────────────────────────────────────

async function authenticate(): Promise<SessionData> {
  // 1. In-memory hit
  if (sessionCache) return sessionCache;

  // 2. Disk hit (survives dev-server restarts)
  const persisted = loadPersistedSession();
  if (persisted) {
    // If env key changed since last persist, discard stale session
    const envKey = process.env.BUNQ_API_KEY;
    if (!envKey || persisted.apiKey === envKey) {
      sessionCache = persisted;
      return sessionCache;
    }
    clearPersistedSession();
  }

  // 3. Circuit breaker
  if (authFailedAt && Date.now() - authFailedAt < AUTH_RETRY_COOLDOWN_MS) {
    const waitSec = Math.ceil((AUTH_RETRY_COOLDOWN_MS - (Date.now() - authFailedAt)) / 1000);
    throw new Error(`bunq auth failed recently — wait ${waitSec}s before retrying`);
  }

  try {
    // 4. Resolve API key — auto-create sandbox user if none configured
    let apiKey = process.env.BUNQ_API_KEY?.trim();
    if (!apiKey) {
      if (!isSandbox()) throw new Error("BUNQ_API_KEY is required in production mode");
      apiKey = await createSandboxUser();
    }

    const { privateKey, publicKey } = generateKeyPair();

    // Step 1 — Installation
    const installResp = (await bunqRequest("POST", "/v1/installation", { client_public_key: publicKey }, null, null)) as
      { Response: Array<{ Token?: { token: string } }> };
    const installationToken = installResp.Response.find((r) => r.Token)?.Token?.token;
    if (!installationToken) throw new Error("No installation token received");

    // Step 2 — Device server
    await bunqRequest("POST", "/v1/device-server", {
      description: "Context Split — bunq Hackathon",
      secret: apiKey,
      permitted_ips: ["*"],
    }, installationToken, privateKey);

    // Step 3 — Session server
    const sessionResp = (await bunqRequest("POST", "/v1/session-server", { secret: apiKey }, installationToken, privateKey)) as {
      Response: Array<{ Token?: { token: string }; UserPerson?: { id: number }; UserCompany?: { id: number } }>;
    };
    const sessionToken = sessionResp.Response.find((r) => r.Token)?.Token?.token;
    const userId =
      sessionResp.Response.find((r) => r.UserPerson)?.UserPerson?.id ??
      sessionResp.Response.find((r) => r.UserCompany)?.UserCompany?.id;
    if (!sessionToken || !userId) throw new Error("Session auth failed");

    // Step 4 — Primary monetary account
    const accountsResp = (await bunqRequest("GET", `/v1/user/${userId}/monetary-account`, null, sessionToken, privateKey)) as {
      Response: Array<{ MonetaryAccountBank?: { id: number; status: string } }>;
    };
    const activeAccount = accountsResp.Response.find(
      (r) => r.MonetaryAccountBank?.status === "ACTIVE"
    )?.MonetaryAccountBank;
    if (!activeAccount) throw new Error("No active monetary account found");

    const session: SessionData = {
      apiKey,
      token: sessionToken,
      userId,
      accountId: activeAccount.id,
      privateKey,
      installationToken,
    };

    persistSession(session);
    sessionCache = session;
    authFailedAt = null;
    console.log(`bunq authenticated — user ${userId}, account ${activeAccount.id}`);
    return session;
  } catch (err) {
    authFailedAt = Date.now();
    throw err;
  }
}

async function authenticatedRequest(method: string, urlPath: string, body: object | null = null): Promise<unknown> {
  const session = await authenticate();
  try {
    return await bunqRequest(method, urlPath, body, session.token, session.privateKey);
  } catch (err) {
    // Session expired — wipe and retry once
    if (err instanceof Error && err.message.includes("401")) {
      clearPersistedSession();
      authFailedAt = null;
      const fresh = await authenticate();
      return bunqRequest(method, urlPath, body, fresh.token, fresh.privateKey);
    }
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBunqContacts(): Promise<BunqContact[]> {
  // In sandbox without an explicit API key we'll auto-create a user — skip contact
  // fetch and return mocks so the UI has recognisable names to show.
  if (!process.env.BUNQ_API_KEY) return MOCK_CONTACTS;

  try {
    const session = await authenticate();
    const resp = (await authenticatedRequest("GET", `/v1/user/${session.userId}/contact`)) as {
      Response: Array<{ Contact?: { name: string; alias: Array<{ type: string; value: string }> } }>;
    };
    return resp.Response.filter((r) => r.Contact).map((r, i) => ({
      id: String(i + 1),
      name: r.Contact!.name,
      aliases: r.Contact!.alias.map((a) => ({ type: a.type, value: a.value })),
    }));
  } catch (err) {
    console.error("bunq contacts fetch failed, using mock:", err);
    return MOCK_CONTACTS;
  }
}

export async function createRequestInquiry(
  counterpartyName: string,
  _counterpartyAlias: { type: string; value: string },
  amount: number,
  currency: string,
  description: string
): Promise<{ id: number }> {
  const session = await authenticate();

  // In sandbox mode route every request through sugardaddy@bunq.com so it
  // auto-accepts immediately — perfect for live demos.
  const alias = isSandbox()
    ? { type: "EMAIL", value: SANDBOX_SUGAR_DADDY, name: "Sugar Daddy" }
    : { type: _counterpartyAlias.type, value: _counterpartyAlias.value, name: counterpartyName };

  const resp = (await authenticatedRequest(
    "POST",
    `/v1/user/${session.userId}/monetary-account/${session.accountId}/request-inquiry`,
    {
      amount_inquired: { value: amount.toFixed(2), currency },
      counterparty_alias: alias,
      description,
      allow_bunqme: false,
    }
  )) as { Response: Array<{ Id?: { id: number } }> };

  const id = resp.Response[0]?.Id?.id;
  if (!id) throw new Error("No request ID returned");
  return { id };
}

export interface BunqRequestInquiry {
  id: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED" | "EXPIRED";
  amount_inquired: { value: string; currency: string };
  counterparty_alias: { display_name: string; value: string };
  description: string;
  created: string;
}

export async function listRequestInquiries(): Promise<BunqRequestInquiry[]> {
  const session = await authenticate();
  const resp = (await authenticatedRequest(
    "GET",
    `/v1/user/${session.userId}/monetary-account/${session.accountId}/request-inquiry`
  )) as { Response: Array<{ RequestInquiry?: BunqRequestInquiry }> };

  return resp.Response.filter((r) => r.RequestInquiry).map((r) => r.RequestInquiry!);
}

// Creates a fresh sandbox user and returns their email alias.
// Use this to send requests to a real (inspectable) counterparty instead of sugardaddy.
export async function createSandboxCounterparty(displayName: string): Promise<{ apiKey: string; email: string }> {
  if (!isSandbox()) throw new Error("createSandboxCounterparty is only available in sandbox mode");

  // Provision a new sandbox person
  const res = await fetch(`${SANDBOX_BASE}/v1/sandbox-user-person`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bunq-Client-Request-Id": makeRequestId(),
      "X-Bunq-Geolocation": "0 0 0 0 NL",
      "X-Bunq-Language": "en_US",
      "X-Bunq-Region": "en_US",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`sandbox-user-person failed: ${await res.text()}`);
  const data = (await res.json()) as { Response: Array<{ ApiKey?: { api_key: string } }> };
  const apiKey = data.Response.find((r) => r.ApiKey)?.ApiKey?.api_key;
  if (!apiKey) throw new Error("No API key from sandbox-user-person");

  // Authenticate as that user to discover their email alias
  const { privateKey, publicKey } = generateKeyPair();
  const installResp = (await bunqRequest("POST", "/v1/installation", { client_public_key: publicKey }, null, null)) as
    { Response: Array<{ Token?: { token: string } }> };
  const installToken = installResp.Response.find((r) => r.Token)?.Token?.token!;

  await bunqRequest("POST", "/v1/device-server", {
    description: `Context Split — ${displayName}`,
    secret: apiKey,
    permitted_ips: ["*"],
  }, installToken, privateKey);

  const sessionResp = (await bunqRequest("POST", "/v1/session-server", { secret: apiKey }, installToken, privateKey)) as {
    Response: Array<{ Token?: { token: string }; UserPerson?: { id: number } }>;
  };
  const sessionToken = sessionResp.Response.find((r) => r.Token)?.Token?.token!;
  const userId = sessionResp.Response.find((r) => r.UserPerson)?.UserPerson?.id!;

  const userResp = (await bunqRequest("GET", `/v1/user-person/${userId}`, null, sessionToken, privateKey)) as {
    Response: Array<{ UserPerson?: { alias: Array<{ type: string; value: string }> } }>;
  };
  const aliases = userResp.Response.find((r) => r.UserPerson)?.UserPerson?.alias ?? [];
  const email = aliases.find((a) => a.type === "EMAIL")?.value ?? `sandbox-${userId}@bunq.com`;

  console.log(`  Sandbox counterparty created — ${displayName}: ${email}`);
  return { apiKey, email };
}

export function matchContactToSplit(splitName: string, contacts: BunqContact[]): BunqContact | null {
  const lower = splitName.toLowerCase().trim();
  return contacts.find((c) => c.name.toLowerCase().includes(lower)) ?? null;
}

export async function sendAllRequests(
  splits: Array<{ name: string; amount_owed: number; justification: string }>,
  currency: string,
  restaurantName: string
): Promise<RequestStatus[]> {
  const results: RequestStatus[] = [];

  // Attempt real bunq auth (will auto-create sandbox user if no key set)
  let useMock = false;
  try {
    await authenticate();
  } catch (err) {
    console.warn("bunq auth unavailable, falling back to mock:", (err as Error).message);
    useMock = true;
  }

  const contacts = await getBunqContacts();

  for (const split of splits) {
    if (useMock) {
      await new Promise((r) => setTimeout(r, 300));
      results.push({ name: split.name, status: "mock", requestId: `mock_${Math.random().toString(36).slice(2)}`, amount: split.amount_owed, currency });
      continue;
    }

    const contact = matchContactToSplit(split.name, contacts);
    const alias = contact?.aliases[0] ?? { type: "EMAIL", value: SANDBOX_SUGAR_DADDY };

    try {
      const description = `${split.name}'s share from ${restaurantName || "dinner"}: ${split.justification}`;
      const { id } = await createRequestInquiry(split.name, alias, split.amount_owed, currency, description);
      results.push({ name: split.name, status: "sent", requestId: String(id), amount: split.amount_owed, currency });
    } catch (err) {
      results.push({ name: split.name, status: "failed", amount: split.amount_owed, currency, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return results;
}
