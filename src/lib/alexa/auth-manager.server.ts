/**
 * AlexaAuthManager – Login with Amazon (LWA).
 *
 * Server-only. Liest AMAZON_CLIENT_ID / AMAZON_CLIENT_SECRET ausschließlich
 * innerhalb der Funktionen. Tokens verlassen diese Schicht niemals Richtung
 * Browser.
 */

const AUTHORIZE_URL = "https://www.amazon.com/ap/oa";
const TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const PROFILE_URL = "https://api.amazon.com/user/profile";

/** Vom Amazon-Konto angeforderte Berechtigungen (offizielle LWA-Scopes). */
export const AMAZON_SCOPES = ["profile", "profile:user_id"] as const;

export type AmazonTokens = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope: string | null;
  expiresAt: string;
};

export type AmazonProfile = {
  amazonUserId: string | null;
  name: string | null;
  email: string | null;
};

export function amazonConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env["AMAZON_CLIENT_ID"];
  const clientSecret = process.env["AMAZON_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const config = amazonConfig();
  if (!config) throw new Error("Amazon-Zugangsdaten sind im Backend nicht hinterlegt.");
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", AMAZON_SCOPES.join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<AmazonTokens> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as TokenPayload;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.error ??
        `Amazon antwortete mit Status ${response.status}.`,
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? "bearer",
    scope: payload.scope ?? null,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<AmazonTokens> {
  const config = amazonConfig();
  if (!config) throw new Error("Amazon-Zugangsdaten sind im Backend nicht hinterlegt.");
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  );
}

export async function refreshTokens(refreshToken: string): Promise<AmazonTokens> {
  const config = amazonConfig();
  if (!config) throw new Error("Amazon-Zugangsdaten sind im Backend nicht hinterlegt.");
  const tokens = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  );
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

export async function fetchProfile(accessToken: string): Promise<AmazonProfile> {
  const response = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { amazonUserId: null, name: null, email: null };
  const payload = (await response.json().catch(() => ({}))) as {
    user_id?: string;
    name?: string;
    email?: string;
  };
  return {
    amazonUserId: payload.user_id ?? null,
    name: payload.name ?? null,
    email: payload.email ?? null,
  };
}

/** Läuft das Token in den nächsten 60 Sekunden ab? */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() - 60_000 <= Date.now();
}
