const express = require("express");
const cors = require("cors");
const GraphiQL = require("zendro-graphiql");

// This deployment lives on its own origin, separate from the actual
// graphql-server it talks to (unlike graphql-server's own integration,
// which mounts GraphiQL alongside its native /graphql handler in the same
// process). So /graphql, /meta_query and /auth/* here are all reverse
// proxies: the browser only ever talks to this origin. graphql-server is
// also the only service with real Keycloak credentials - it owns
// authentication (and, via ACL, authorization) for the whole deployment, so
// this app has none of its own; see zendro-graphiql's README, "Acting as an
// auth backend for other origins".
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function forwardableHeaders(req, extraHeaders) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
  }
  return { ...headers, ...extraHeaders };
}

// Relays upstream's response as-is, including every Set-Cookie header
// individually - Headers#forEach would otherwise comma-join repeated
// headers, which isn't a valid way to send more than one cookie.
async function relay(res, upstream) {
  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie" && !HOP_BY_HOP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
  });
  const setCookies = upstream.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) res.setHeader("set-cookie", setCookies);
  res.send(Buffer.from(await upstream.arrayBuffer()));
}

// manualRedirect: relay 3xx responses (and their Location header) to the
// browser as-is, instead of fetch silently following them itself - required
// for /auth/*, where the redirects (to the identity provider, and back) are
// meant for the browser, not this server.
function proxyTo(remoteUrl, { manualRedirect = false, extraHeaders } = {}) {
  return async (req, res) => {
    try {
      const target = new URL(remoteUrl);
      const [, search] = req.originalUrl.split("?");
      if (search) target.search = search;

      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardableHeaders(req, extraHeaders),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
        redirect: manualRedirect ? "manual" : "follow",
      });

      await relay(res, upstream);
    } catch (err) {
      res.status(502).json({ errors: [{ message: `Failed to reach ${remoteUrl}: ${err.message}` }] });
    }
  };
}

// Like proxyTo, but the target path is this request's own path appended to
// authBaseUrl, rather than a single fixed URL - one middleware handles
// /auth/login, /auth/callback, /auth/session and /auth/logout alike.
function proxyAuthTo(authBaseUrl, redirectUri) {
  const base = authBaseUrl.replace(/\/$/, "");
  return (req, res) => {
    const extraHeaders = redirectUri ? { "x-zendro-auth-redirect-uri": redirectUri } : undefined;
    return proxyTo(`${base}${req.path}`, { manualRedirect: true, extraHeaders })(req, res);
  };
}

/**
 * createApp({ graphqlUrl, metaQueryUrl, authBaseUrl, redirectUri, graphiqlOptions, maxBodySize }) -> Express app
 *
 * graphiqlOptions is the same options object passed to GraphiQL(options) - see
 * zendro-graphiql's README. graphqlUrl is required; metaQueryUrl is optional
 * (the filter panel is only useful if graphiqlOptions.features.filter.enabled
 * is also true). authBaseUrl, when set, proxies /auth/* to graphql-server's
 * own auth routes (see zendro-graphiql's features.auth.proxied) instead of
 * this app running its own OAuth2 flow - redirectUri is this app's own
 * `<origin>/auth/callback`, sent so graphql-server knows which origin to run
 * login/logout on behalf of.
 */
function createApp({ graphqlUrl, metaQueryUrl, authBaseUrl, redirectUri, graphiqlOptions, maxBodySize }) {
  if (!graphqlUrl) {
    throw new Error("createApp: graphqlUrl is required - the /graphql endpoint of the target graphql-server.");
  }

  const app = express();

  // express.raw (not express.json) so the request body is forwarded exactly
  // as received, rather than parsed and re-serialized.
  const rawBody = express.raw({ type: "*/*", limit: maxBodySize || "1mb" });

  if (authBaseUrl) {
    app.use("/auth", cors(), proxyAuthTo(authBaseUrl, redirectUri));
  }

  // No session/token handling here at all: the session cookie set by the
  // proxied /auth/callback above is opaque to this app - it's forwarded
  // through untouched, and graphql-server resolves it into a Bearer token
  // itself once the request arrives there.
  app.all("/graphql", cors(), rawBody, proxyTo(graphqlUrl));

  if (metaQueryUrl) {
    const metaQueryCorsOptions = { allowedHeaders: ["Content-Type", "Authorization", "jq", "jsonPath"] };
    app.options("/meta_query", cors(metaQueryCorsOptions));
    app.post("/meta_query", cors(), rawBody, proxyTo(metaQueryUrl));
  }

  // Registered last: GraphiQL's own catch-all (static assets + index.html)
  // would otherwise shadow nothing here since none of its own routes match
  // /graphql, /meta_query or /auth, but keeping it last avoids relying on that.
  app.use("/", GraphiQL(graphiqlOptions));

  return app;
}

module.exports = createApp;
