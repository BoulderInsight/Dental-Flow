import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { encrypt, decrypt } from "@/lib/encryption";

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function createLinkToken(
  userId: string,
  practiceId: string
): Promise<string> {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: `${practiceId}-${userId}` },
    client_name: "PracticePulse",
    products: [Products.Transactions, Products.Investments, Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return response.data.link_token;
}

export async function exchangePublicToken(
  publicToken: string
): Promise<{ accessToken: string; itemId: string }> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const encryptedToken = encrypt(response.data.access_token);
  return {
    accessToken: encryptedToken,
    itemId: response.data.item_id,
  };
}

export async function getAccounts(encryptedAccessToken: string) {
  const accessToken = decrypt(encryptedAccessToken);
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });
  return response.data.accounts;
}

export async function getBalances(encryptedAccessToken: string) {
  const accessToken = decrypt(encryptedAccessToken);
  const response = await plaidClient.accountsBalanceGet({
    access_token: accessToken,
  });
  return response.data.accounts;
}
