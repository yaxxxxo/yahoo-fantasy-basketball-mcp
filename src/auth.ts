import { createServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTokens, saveTokens, getConfigDir, type Tokens } from "./token-store.js";

const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const REDIRECT_URI = "https://localhost:9876/callback";
const SCOPES = "openid";

function getLocalCert(): { key: string; cert: string } {
  const configDir = getConfigDir();
  const keyPath = join(configDir, "localhost-key.pem");
  const certPath = join(configDir, "localhost-cert.pem");

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    mkdirSync(configDir, { recursive: true });
    console.error("Generating self-signed certificate for OAuth callback...");
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`,
      { stdio: "pipe" }
    );
  }

  return {
    key: readFileSync(keyPath, "utf-8"),
    cert: readFileSync(certPath, "utf-8"),
  };
}

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      "Missing required environment variable: YAHOO_CLIENT_ID. " +
        "Set it to your Yahoo app's client ID."
    );
  }
  if (!clientSecret) {
    throw new Error(
      "Missing required environment variable: YAHOO_CLIENT_SECRET. " +
        "Set it to your Yahoo app's client secret."
    );
  }

  return { clientId, clientSecret };
}

function isTokenValid(tokens: Tokens): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() < tokens.expires_at - bufferMs;
}

function buildAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<Tokens> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshTokens(tokens: Tokens): Promise<Tokens | null> {
  const { clientId, clientSecret } = getCredentials();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  console.error("Refreshing access token...");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
  });

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });
  } catch {
    return null;
  }

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    // Check for invalid_grant which signals we need to re-auth
    if (text.includes("invalid_grant")) {
      return null;
    }
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  };

  const newTokens: Tokens = {
    access_token: data.access_token,
    // Yahoo may not always return a new refresh_token; keep the old one
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    token_type: data.token_type,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await saveTokens(newTokens);
  return newTokens;
}

async function doFullAuth(clientId: string, clientSecret: string): Promise<Tokens> {
  const authUrl = buildAuthUrl(clientId);

  return new Promise<Tokens>((resolve, reject) => {
    let server: ReturnType<typeof createServer> | null = null;
    let settled = false;

    // Short initial timeout before we tell the user to use manual flow
    const BROWSER_TIMEOUT_MS = 60 * 1000; // 60 seconds
    const MANUAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total

    function cleanup(err?: Error): void {
      if (settled) return;
      settled = true;
      if (server) {
        server.close();
        server = null;
      }
      if (err) {
        reject(err);
      }
    }

    // Set the overall timeout
    const overallTimer = setTimeout(() => {
      cleanup(new Error("Authorization timed out after 5 minutes."));
    }, MANUAL_TIMEOUT_MS);

    // After 60s without a callback, print URL to stderr for manual entry
    const browserTimer = setTimeout(() => {
      console.error(`If browser didn't open, visit: ${authUrl}`);
    }, BROWSER_TIMEOUT_MS);

    const tlsOptions = getLocalCert();
    server = createServer(tlsOptions, (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      const parsedUrl = new URL(req.url, "https://localhost:9876");

      if (parsedUrl.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          `<html><body><h1>Authorization failed</h1><p>${error}</p><p>You can close this tab.</p></body></html>`
        );
        clearTimeout(overallTimer);
        clearTimeout(browserTimer);
        cleanup(new Error(`Authorization error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("Missing authorization code");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<html><body><h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>"
      );

      clearTimeout(overallTimer);
      clearTimeout(browserTimer);

      console.error("Authorization successful!");

      if (settled) return;
      settled = true;
      if (server) {
        server.close();
        server = null;
      }

      exchangeCodeForTokens(code, clientId, clientSecret)
        .then((tokens) => saveTokens(tokens).then(() => resolve(tokens)))
        .catch(reject);
    });

    server.on("error", (err: Error) => {
      clearTimeout(overallTimer);
      clearTimeout(browserTimer);
      cleanup(err);
    });

    server.listen(9876, "localhost", async () => {
      console.error("Opening browser for Yahoo authorization...");

      try {
        const open = (await import("open")).default;
        await open(authUrl);
      } catch {
        // If open() fails, the browser timer will handle printing the URL
        console.error(`If browser didn't open, visit: ${authUrl}`);
      }
    });
  });
}

export async function authenticate(): Promise<Tokens> {
  const { clientId, clientSecret } = getCredentials();

  // Check for existing tokens
  const existing = await loadTokens();

  if (existing) {
    if (isTokenValid(existing)) {
      return existing;
    }

    // Try refresh first
    if (existing.refresh_token) {
      const refreshed = await refreshTokens(existing);
      if (refreshed) {
        return refreshed;
      }
    }

    console.error("Session expired, re-authenticating...");
  }

  return doFullAuth(clientId, clientSecret);
}

export async function getAccessToken(): Promise<string> {
  const tokens = await authenticate();
  return tokens.access_token;
}
