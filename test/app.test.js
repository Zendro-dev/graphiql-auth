const test = require("node:test");
const assert = require("node:assert/strict");
const createApp = require("../app");
const { startFakeIdp } = require("./helpers/fakeIdp");
const { startFakeUpstream, closeServer } = require("./helpers/fakeUpstream");

const authConfig = {
  clientId: "zendro_graphiql",
  clientSecret: "test-secret",
  // Never actually contacted by the tests in this file that don't exercise
  // /auth/login or /auth/callback - discovery only happens lazily.
  issuerUri: "http://keycloak.example",
  redirectUri: "http://localhost:0/auth/callback",
  sessionSecret: "session-signing-secret",
};

test("createApp requires graphqlUrl", () => {
  assert.throws(() => createApp({ graphiqlOptions: {} }), /graphqlUrl is required/);
});

test("app: GraphiQL served at / and /graphql proxies to the upstream", async (t) => {
  const upstream = await startFakeUpstream((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { __typename: "Query" } }));
  });
  t.after(() => closeServer(upstream.server));

  const app = createApp({
    graphqlUrl: upstream.url,
    metaQueryUrl: `${upstream.url}/meta_query`,
    graphiqlOptions: { mountPath: "/", features: { auth: { enabled: true, ...authConfig }, filter: { enabled: true } } },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  t.after(() => closeServer(server));

  await t.test("GraphiQL SPA served at /", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /__ZENDRO_GRAPHIQL__/);
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

  await t.test("/graphql without a session/header forwards no Authorization", async () => {
    await fetch(`${base}/graphql`, { method: "POST", body: "{}" });
    assert.equal(upstream.requests.at(-1).headers.authorization, undefined);
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

test("app: a logged-in session gets its token injected into proxied /graphql requests", async (t) => {
  const upstream = await startFakeUpstream((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: null }));
  });
  t.after(() => closeServer(upstream.server));

  const idp = await startFakeIdp();
  t.after(() => idp.close());

  const app = createApp({
    graphqlUrl: upstream.url,
    graphiqlOptions: {
      mountPath: "/",
      features: { auth: { enabled: true, ...authConfig, issuerUri: idp.issuer } },
    },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  t.after(() => closeServer(server));

  // Full login round trip, then confirm the token never appears in any
  // response to the browser - only in what the proxy forwards upstream.
  const loginRes = await fetch(`${base}/auth/login`, { redirect: "manual" });
  const flowCookie = loginRes.headers.get("set-cookie").split(";")[0];
  const state = new URL(loginRes.headers.get("location")).searchParams.get("state");

  const callbackRes = await fetch(`${base}/auth/callback?code=abc&state=${state}`, {
    headers: { cookie: flowCookie },
    redirect: "manual",
  });
  assert.equal(callbackRes.status, 302);
  assert.equal(callbackRes.headers.get("location"), "/");
  const sessionCookie = callbackRes.headers.get("set-cookie").split(",").find((c) => c.includes("zendro_giql_session"));
  assert.ok(sessionCookie, "expected a session cookie to be set after a successful callback");
  assert.doesNotMatch(sessionCookie.split(";")[0], /fake-access-token/, "the raw access token must never be in the cookie itself");

  const graphqlRes = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { cookie: sessionCookie.split(";")[0] },
    body: "{}",
  });
  const resBody = await graphqlRes.text();
  assert.doesNotMatch(resBody, /fake-access-token/, "the token must never come back in a response to the browser");
  assert.equal(upstream.requests.at(-1).headers.authorization, "Bearer fake-access-token-for-authorization_code");
});
