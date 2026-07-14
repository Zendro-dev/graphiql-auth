// Unlike the rest of the suite (which fakes the identity provider), this
// talks to a REAL, already-running Keycloak. It exists to catch the class
// of bug unit tests can't: wrong ports/hostnames, a misregistered redirect
// URI, a realm/client that doesn't actually accept this config.
//
// This app has no Keycloak credentials of its own (see app.js/server.js) -
// /auth/* is reverse-proxied to graphql-server, which owns the real OAuth2
// flow. Since booting a real graphql-server needs generated resolvers/
// schemas and a database (out of scope for this checkout), a "gqs
// stand-in" is spun up here using the same zendro-graphiql package graphql-
// server itself uses, wired up the same way (see its server.js): a real,
// non-proxied auth router talking to the real Keycloak, plus a stub
// /graphql that echoes the Authorization header it received so the test
// can assert on it.
//
// Skips itself (rather than failing) whenever the configured Keycloak isn't
// reachable, so it never breaks CI or a machine that doesn't have the
// Zendro dev stack running. Run explicitly with `npm run test:live`.
require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cors = require("cors");
const createApp = require("../../app");
const { closeServer } = require("../helpers/fakeUpstream");
const { authRouter, attachAuthFromSession } = require("../helpers/gqsAuth");

const ISSUER_URI = process.env.OAUTH2_ISSUER_URI;
// Only needed when ISSUER_URI isn't reachable from here directly (e.g. a
// dockerized Keycloak reachable only via its internal service hostname).
const ISSUER_INTERNAL_URI = process.env.OAUTH2_ISSUER_INTERNAL_URI;
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

// See the file header - stands in for a real graphql-server's own
// utils/auth wiring, the thing this app's /auth/* and /graphql actually
// proxy to (see test/helpers/gqsAuth, a test-only duplicate of it).
async function startGqsStandin() {
  const authConfig = {
    enabled: true,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    issuerUri: ISSUER_URI,
    issuerInternalUri: ISSUER_INTERNAL_URI,
    // Never actually used - every request in this test carries the
    // X-Zendro-Auth-Redirect-Uri override below, but a value is still
    // required to construct the router.
    redirectUri: "http://gqs-standin.invalid/auth/callback",
    allowedRedirectUris: [`${ORIGIN}/*`],
    sessionSecret: SESSION_SECRET,
  };
  const app = express();
  app.use("/auth", authRouter(authConfig));
  const attachGraphiqlSession = attachAuthFromSession(authConfig);
  app.all("/graphql", cors(), attachGraphiqlSession, (req, res) => res.json({ authHeader: req.headers.authorization || null }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, url: `http://localhost:${server.address().port}` };
}

test("live login against a real Keycloak, proxied through this app to a gqs stand-in", { skip: !ISSUER_URI || !CLIENT_SECRET }, async (t) => {
  if (!ISSUER_URI || !CLIENT_SECRET) return;

  const reachable = await isReachable(`${ISSUER_INTERNAL_URI || ISSUER_URI}/.well-known/openid-configuration`);
  if (!reachable) {
    t.skip(`Keycloak at ${ISSUER_INTERNAL_URI || ISSUER_URI} is not reachable - is the Zendro dev stack running?`);
    return;
  }

  const gqs = await startGqsStandin();
  t.after(() => closeServer(gqs.server));

  const app = createApp({
    graphqlUrl: `${gqs.url}/graphql`,
    authBaseUrl: `${gqs.url}/auth`,
    redirectUri: REDIRECT_URI,
    graphiqlOptions: { features: { auth: true } },
  });
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
    assert.ok(authorizeUrl?.startsWith(ISSUER_URI), "expected /auth/login (proxied to gqs) to redirect into the configured Keycloak realm");

    const redirectBack = await performKeycloakLogin(authorizeUrl);
    assert.ok(redirectBack.startsWith(REDIRECT_URI), "expected Keycloak to redirect back to this app's own redirect_uri, not gqs's");

    const callbackRes = await fetch(redirectBack, { redirect: "manual", headers: { cookie: cookieHeader(appJar) } });
    assert.equal(callbackRes.status, 302, "expected the callback to create a session and redirect back to this app's root");
    absorbSetCookie(appJar, callbackRes);
    assert.ok(appJar.zendro_giql_session, "expected a session cookie to be set");

    const graphqlRes = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { cookie: cookieHeader(appJar), "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });
    // The fake gqs's /graphql deliberately echoes the Authorization header
    // back so this can be asserted on - a real graphql-server never would.
    const { authHeader } = await graphqlRes.json();

    assert.match(authHeader || "", /^Bearer /, "expected the real access token to be attached server-side, by gqs, not this app");
    const token = authHeader.replace("Bearer ", "");
    assert.equal(token.split(".").length, 3, "expected a JWT access token");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    assert.equal(payload.preferred_username, TEST_USERNAME);

    // The whole point of the BFF pattern: the token must never appear
    // anywhere the browser can see it, even on a real, live login - and
    // this app, proxying blind, never even gets a chance to leak it since
    // it never looks at the session cookie's contents at all.
    for (const cookieValue of Object.values(appJar)) {
      assert.doesNotMatch(decodeURIComponent(cookieValue), new RegExp(token.replace(/[.]/g, "\\.")));
    }
  });
});
