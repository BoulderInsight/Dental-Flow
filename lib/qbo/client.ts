import OAuthClient from "intuit-oauth";

let oauthClient: OAuthClient | null = null;

export function getOAuthClient(): OAuthClient {
  if (oauthClient) return oauthClient;

  oauthClient = new OAuthClient({
    clientId: process.env.INTUIT_CLIENT_ID!,
    clientSecret: process.env.INTUIT_CLIENT_SECRET!,
    environment:
      (process.env.INTUIT_ENVIRONMENT as "sandbox" | "production") ||
      "sandbox",
    redirectUri: process.env.INTUIT_REDIRECT_URI!,
  });

  return oauthClient;
}

export function generateAuthUrl(): string {
  const client = getOAuthClient();
  return client.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: "dentalflow-connect",
  });
}

export async function exchangeCode(
  url: string
): Promise<{ accessToken: string; refreshToken: string; realmId: string }> {
  const client = getOAuthClient();
  const response = await client.createToken(url);
  const token = response.getJson();

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    realmId: token.realmId || "",
  };
}

export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const client = getOAuthClient();
  client.setToken({ refresh_token: refreshToken } as Parameters<typeof client.setToken>[0]);
  const response = await client.refresh();
  const token = response.getJson();

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  };
}

export async function makeApiCall(
  accessToken: string,
  realmId: string,
  endpoint: string
): Promise<unknown> {
  const client = getOAuthClient();
  client.setToken({ access_token: accessToken } as Parameters<typeof client.setToken>[0]);

  const baseUrl =
    process.env.INTUIT_ENVIRONMENT === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";

  const response = await client.makeApiCall({
    url: `${baseUrl}/v3/company/${realmId}/${endpoint}`,
  });

  return JSON.parse(response.text());
}
