declare module "intuit-oauth" {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: "sandbox" | "production";
    redirectUri: string;
  }

  interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  interface TokenResponse {
    getJson(): {
      access_token: string;
      refresh_token: string;
      realmId?: string;
      token_type: string;
      expires_in: number;
    };
    text(): string;
  }

  interface ApiCallOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
    };

    constructor(config: OAuthClientConfig);
    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(uri: string): Promise<TokenResponse>;
    refresh(): Promise<TokenResponse>;
    setToken(token: Record<string, unknown>): void;
    makeApiCall(options: ApiCallOptions): Promise<{ text(): string }>;
  }

  export default OAuthClient;
}
