// openid-client is ESM-only; loaded via dynamic import from this CJS module.
let clientPromise;
function loadClient() {
  if (!clientPromise) clientPromise = import("openid-client");
  return clientPromise;
}

// Discovery is an extra round trip to the identity provider, so the
// resulting Configuration (server metadata + JWKS) is cached per issuer -
// every login/callback/refresh/logout reuses it instead of re-discovering.
const configCache = new Map();

async function discoverVia(client, authConfig) {
  const discoveryUrl = new URL(".well-known/openid-configuration", authConfig.issuerInternalUri.replace(/\/?$/, "/"));
  const res = await fetch(discoveryUrl);
  if (!res.ok) throw new Error(`discovery request to ${discoveryUrl} failed with ${res.status} ${res.statusText}`);
  const metadata = await res.json();
  if (metadata.issuer !== authConfig.issuerUri) {
    throw new Error(`discovered issuer "${metadata.issuer}" does not match the expected issuerUri "${authConfig.issuerUri}"`);
  }
  const config = new client.Configuration(metadata, authConfig.clientId, authConfig.clientSecret);
  if (new URL(authConfig.issuerInternalUri).protocol === "http:") client.allowInsecureRequests(config);
  return config;
}

async function getConfiguration(authConfig) {
  const cacheKey = `${authConfig.issuerUri}::${authConfig.clientId}`;
  if (!configCache.has(cacheKey)) {
    configCache.set(
      cacheKey,
      (async () => {
        const client = await loadClient();
        if (authConfig.issuerInternalUri) return discoverVia(client, authConfig);
        const issuer = new URL(authConfig.issuerUri);
        const options = issuer.protocol === "http:" ? { execute: [client.allowInsecureRequests] } : undefined;
        return client.discovery(issuer, authConfig.clientId, authConfig.clientSecret, undefined, options);
      })()
    );
  }
  try {
    return await configCache.get(cacheKey);
  } catch (err) {
    configCache.delete(cacheKey);
    throw err;
  }
}

module.exports = { loadClient, getConfiguration };
