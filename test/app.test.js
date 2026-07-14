const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const express = require("express");
const cors = require("cors");
const createApp = require("../app");
const { startFakeIdp } = require("./helpers/fakeIdp");
const { startFakeUpstream, closeServer } = require("./helpers/fakeUpstream");
const { authRouter, attachAuthFromSession } = require("./helpers/gqsAuth");

function getEphemeralPort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

// Stands in for graphql-server's own wiring (see its server.js and
// utils/auth/) - authRouter(...) mounted at the top-level /auth (real
// allowlist), attachAuthFromSession wired into its own /graphql. This
// app.js has none of that - it reverse-proxies to something shaped exactly
// like this (see test/helpers/gqsAuth, a test-only duplicate of gqs's own
// utils/auth - graphiql-auth and graphql-server are separate repos with no
// runtime dependency on each other).
async function startFakeGqs(idp, allowedRedirectUris) {
  const authConfig = {
    enabled: true,
    clientId: "zendro_graphiql",
    clientSecret: "test-secret",
    issuerUri: idp.issuer,
    redirectUri: "http://gqs.example/auth/callback",
    allowedRedirectUris,
    sessionSecret: "gqs-session-secret",
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

test("createApp requires graphqlUrl", () => {
  assert.throws(() => createApp({ graphiqlOptions: {} }), /graphqlUrl is required/);
});

test("app: GraphiQL served at / and /graphql, /meta_query proxy to the upstream", async (t) => {
  const upstream = await startFakeUpstream((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { __typename: "Query" } }));
  });
  t.after(() => closeServer(upstream.server));

  const app = createApp({
    graphqlUrl: upstream.url,
    metaQueryUrl: `${upstream.url}/meta_query`,
    graphiqlOptions: { features: { auth: true, filter: true } },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  t.after(() => closeServer(server));

  await t.test("GraphiQL SPA served at /, with auth shown as enabled (UI only)", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /__ZENDRO_GRAPHIQL__/);
    assert.match(html, /"auth":\{"enabled":true\}/);
  });

  await t.test("/graphql forwards method, body and query to the upstream", async () => {
    const res = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: { __typename: "Query" } });

    const forwarded = upstream.requests.at(-1);
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.headers["content-type"], "application/json");
    assert.equal(forwarded.body, JSON.stringify({ query: "{ __typename }" }));
  });

  await t.test("/graphql forwards cookies as-is - this app never interprets the session itself", async () => {
    await fetch(`${base}/graphql`, { method: "POST", headers: { cookie: "zendro_giql_session=opaque-to-this-app" }, body: "{}" });
    assert.equal(upstream.requests.at(-1).headers.cookie, "zendro_giql_session=opaque-to-this-app");
  });

  await t.test("/graphql passes an explicit Authorization header through untouched", async () => {
    await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { Authorization: "Bearer manual-token" },
      body: "{}",
    });
    assert.equal(upstream.requests.at(-1).headers.authorization, "Bearer manual-token");
  });

  await t.test("/meta_query forwards jq/jsonPath headers to its own upstream URL", async () => {
    const res = await fetch(`${base}/meta_query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", jq: ".data" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });
    assert.equal(res.status, 200);
    const forwarded = upstream.requests.at(-1);
    assert.equal(forwarded.url, "/meta_query");
    assert.equal(forwarded.headers.jq, ".data");
  });
});

test("app: /auth/* proxies to graphql-server, which runs the real OAuth2 flow on this app's behalf", async (t) => {
  const idp = await startFakeIdp();
  t.after(() => idp.close());

  const ownPort = await getEphemeralPort();
  const ownOrigin = `http://localhost:${ownPort}`;
  const gqs = await startFakeGqs(idp, [`${ownOrigin}/*`]);
  t.after(() => closeServer(gqs.server));

  const app = createApp({
    graphqlUrl: `${gqs.url}/graphql`,
    authBaseUrl: `${gqs.url}/auth`,
    redirectUri: `${ownOrigin}/auth/callback`,
    graphiqlOptions: { features: { auth: true } },
  });
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(ownPort, () => resolve(s));
    s.on("error", reject);
  });
  t.after(() => closeServer(server));

  await t.test("/auth/login proxies to gqs, which redirects to the identity provider using this app's own redirect_uri", async () => {
    const res = await fetch(`${ownOrigin}/auth/login`, { redirect: "manual" });
    assert.equal(res.status, 302);
    const location = new URL(res.headers.get("location"));
    assert.ok(location.href.startsWith(idp.issuer), "expected a redirect into the (fake) identity provider");
    assert.equal(location.searchParams.get("redirect_uri"), `${ownOrigin}/auth/callback`);
  });

  await t.test("full login round trip: session ends up scoped to this app's own origin, token never reaches the browser", async () => {
    const loginRes = await fetch(`${ownOrigin}/auth/login`, { redirect: "manual" });
    const flowCookie = loginRes.headers.get("set-cookie").split(";")[0];
    const state = new URL(loginRes.headers.get("location")).searchParams.get("state");

    const callbackRes = await fetch(`${ownOrigin}/auth/callback?code=abc&state=${state}`, {
      headers: { cookie: flowCookie },
      redirect: "manual",
    });
    assert.equal(callbackRes.status, 302);
    assert.equal(callbackRes.headers.get("location"), `${ownOrigin}/`, "post-login redirect should land on this app's own root, not gqs's /graphiql");
    const sessionCookie = callbackRes.headers
      .get("set-cookie")
      .split(",")
      .find((c) => c.includes("zendro_giql_session"))
      .split(";")[0];
    assert.doesNotMatch(sessionCookie, /fake-access-token/, "the raw access token must never be in the cookie itself");

    const sessionRes = await fetch(`${ownOrigin}/auth/session`, { headers: { cookie: sessionCookie } });
    assert.deepEqual(await sessionRes.json(), { authenticated: true });

    // The fake gqs's /graphql deliberately echoes the Authorization header
    // back so this can be asserted on - a real graphql-server never would.
    const graphqlRes = await fetch(`${ownOrigin}/graphql`, { headers: { cookie: sessionCookie } });
    const { authHeader } = await graphqlRes.json();
    assert.equal(authHeader, "Bearer fake-access-token-for-authorization_code", "gqs itself resolved the session into a Bearer token - this app never touched it");

    const logoutRes = await fetch(`${ownOrigin}/auth/logout`, { headers: { cookie: sessionCookie }, redirect: "manual" });
    assert.equal(logoutRes.status, 302);
    const logoutLocation = new URL(logoutRes.headers.get("location"));
    assert.equal(logoutLocation.searchParams.get("post_logout_redirect_uri"), `${ownOrigin}/`);
  });
});
