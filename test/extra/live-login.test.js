// Unlike the rest of the suite (which fakes the identity provider), this
// talks to a REAL, already-running Keycloak - the same one this app's own
// .env is configured against. It exists to catch the class of bug unit
// tests can't: wrong ports/hostnames, a misregistered redirect URI, a
// realm/client that doesn't actually accept this app's config. /graphql
// itself is still a local fake upstream, so no real graphql-server is
// required - only Keycloak.
//
// Skips itself (rather than failing) whenever the configured Keycloak isn't
// reachable, so it never breaks CI or a machine that doesn't have the
// Zendro dev stack running. Run explicitly with `npm run test:live`.
require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert/strict");
const createApp = require("../../app");
const { startFakeUpstream, closeServer } = require("../helpers/fakeUpstream");

const ISSUER_URI = process.env.OAUTH2_ISSUER_URI;
const CLIENT_ID = process.env.OAUTH2_CLIENT_ID || "zendro_graphiql";
const CLIENT_SECRET = process.env.OAUTH2_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || "live-test-session-secret";
// Mirrors server.js's own derivation (ORIGIN defaults from PORT) so this
// test exercises the exact redirect_uri a real run would use.
const ORIGIN = process.env.ORIGIN || `http://localhost:${process.env.PORT || 7070}`;
const REDIRECT_URI = `${ORIGIN}/auth/callback`;
// A user that already exists in the realm - see graphql-server's
// utils/setup-keycloak.js (createDefaultUser), overridable for other setups.
const TEST_USERNAME = process.env.TEST_USERNAME || "zendro-admin";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "admin";

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function absorbSetCookie(jar, res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Logs in through Keycloak's actual login form (not the API) - the same
// request sequence a browser would make - then hands back the URL Keycloak
// redirects to (our redirect_uri, with ?code=&state=).
async function performKeycloakLogin(authorizeUrl) {
  const kcJar = {};
  const authorizeRes = await fetch(authorizeUrl, { redirect: "manual" });
  absorbSetCookie(kcJar, authorizeRes);
  if (authorizeRes.status !== 200) {
    throw new Error(`unexpected status ${authorizeRes.status} from Keycloak's authorize endpoint`);
  }
  const html = await authorizeRes.text();
  const formActionMatch = html.match(/<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"/);
  if (!formActionMatch) {
    throw new Error("could not find the Keycloak login form - realm/theme may have changed");
  }
  const formAction = formActionMatch[1].replace(/&amp;/g, "&");

  const loginRes = await fetch(formAction, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader(kcJar) },
    body: new URLSearchParams({ username: TEST_USERNAME, password: TEST_PASSWORD }).toString(),
  });
  const location = loginRes.headers.get("location");
  if (loginRes.status !== 302 || !location) {
    throw new Error(
      `Keycloak login did not redirect as expected (status ${loginRes.status}) - check TEST_USERNAME/TEST_PASSWORD and that the account has no pending required actions (e.g. VERIFY_PROFILE)`
    );
  }
  return location;
}

test("live login against a real Keycloak", { skip: !ISSUER_URI || !CLIENT_SECRET }, async (t) => {
  if (!ISSUER_URI || !CLIENT_SECRET) return;

  const reachable = await isReachable(`${ISSUER_URI}/.well-known/openid-configuration`);
  if (!reachable) {
    t.skip(`Keycloak at ${ISSUER_URI} is not reachable - is the Zendro dev stack running?`);
    return;
  }

  const upstream = await startFakeUpstream((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { __typename: "Query" } }));
  });
  t.after(() => closeServer(upstream.server));

  const graphiqlOptions = {
    mountPath: "/",
    features: {
      auth: {
        enabled: true,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        issuerUri: ISSUER_URI,
        redirectUri: REDIRECT_URI,
        sessionSecret: SESSION_SECRET,
      },
    },
  };
  const app = createApp({ graphqlUrl: upstream.url, graphiqlOptions });
  const port = Number(new URL(REDIRECT_URI).port) || 80;
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(port, () => resolve(s));
    s.on("error", reject);
  });
  // Must match the host baked into REDIRECT_URI - Keycloak's token endpoint
  // requires the redirect_uri sent at token-exchange time to exactly match
  // what was sent (and registered) at authorization time.
  const base = new URL(REDIRECT_URI).origin;
  t.after(() => closeServer(server));

  await t.test("full round trip: /auth/login -> real Keycloak login -> /auth/callback -> session authenticates /graphql", async () => {
    const appJar = {};
    const loginRes = await fetch(`${base}/auth/login`, { redirect: "manual" });
    absorbSetCookie(appJar, loginRes);
    const authorizeUrl = loginRes.headers.get("location");
    assert.ok(authorizeUrl?.startsWith(ISSUER_URI), "expected /auth/login to redirect into the configured Keycloak realm");

    const redirectBack = await performKeycloakLogin(authorizeUrl);
    assert.ok(redirectBack.startsWith(REDIRECT_URI), "expected Keycloak to redirect back to our configured redirect_uri");

    const callbackRes = await fetch(redirectBack, { redirect: "manual", headers: { cookie: cookieHeader(appJar) } });
    assert.equal(callbackRes.status, 302, "expected the callback to create a session and redirect to mountPath");
    absorbSetCookie(appJar, callbackRes);
    assert.ok(appJar.zendro_giql_session, "expected a session cookie to be set");

    const graphqlRes = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { cookie: cookieHeader(appJar), "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });
    const responseBody = await graphqlRes.text();

    const forwarded = upstream.requests.at(-1);
    assert.match(forwarded.headers.authorization || "", /^Bearer /, "expected the real access token to be attached server-side");
    const token = forwarded.headers.authorization.replace("Bearer ", "");
    assert.equal(token.split(".").length, 3, "expected a JWT access token");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    assert.equal(payload.preferred_username, TEST_USERNAME);

    // The whole point of the BFF pattern: the token must never appear
    // anywhere the browser can see it, even on a real, live login.
    assert.doesNotMatch(responseBody, new RegExp(token.replace(/[.]/g, "\\.")));
    for (const cookieValue of Object.values(appJar)) {
      assert.doesNotMatch(decodeURIComponent(cookieValue), new RegExp(token.replace(/[.]/g, "\\.")));
    }
  });
});
