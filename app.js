const express = require("express");
const cors = require("cors");
const GraphiQL = require("zendro-graphiql");

// This deployment lives on its own origin, separate from the actual
// graphql-server it talks to (unlike graphql-server's own integration,
// which mounts GraphiQL alongside its native /graphql handler in the same
// process). So /graphql and /meta_query here are reverse proxies: the
// browser only ever talks to this origin, and the session-derived token is
// injected server-side, right before forwarding - it never reaches the
// browser, same as when GraphiQL is embedded directly in graphql-server.
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

function forwardableHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
  }
  return headers;
}

function proxyTo(remoteUrl) {
  return async (req, res) => {
    try {
      const target = new URL(remoteUrl);
      const [, search] = req.originalUrl.split("?");
      if (search) target.search = search;

      const upstream = await fetch(target, {
        method: req.method,
        headers: forwardableHeaders(req),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
      });
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.status(502).json({ errors: [{ message: `Failed to reach ${remoteUrl}: ${err.message}` }] });
    }
  };
}

/**
 * createApp({ graphqlUrl, metaQueryUrl, graphiqlOptions, maxBodySize }) -> Express app
 *
 * graphiqlOptions is the same options object passed to GraphiQL(options) - see
 * zendro-graphiql's README. graphqlUrl is required; metaQueryUrl is optional
 * (the filter panel is only useful if graphiqlOptions.features.filter.enabled
 * is also true).
 */
function createApp({ graphqlUrl, metaQueryUrl, graphiqlOptions, maxBodySize }) {
  if (!graphqlUrl) {
    throw new Error("createApp: graphqlUrl is required - the /graphql endpoint of the target graphql-server.");
  }

  const app = express();
  const attachGraphiqlSession = GraphiQL.attachAuthFromSession(graphiqlOptions);

  // express.raw (not express.json) so the request body is forwarded exactly
  // as received, rather than parsed and re-serialized.
  const rawBody = express.raw({ type: "*/*", limit: maxBodySize || "1mb" });

  app.all("/graphql", cors(), rawBody, attachGraphiqlSession, proxyTo(graphqlUrl));

  if (metaQueryUrl) {
    const metaQueryCorsOptions = { allowedHeaders: ["Content-Type", "Authorization", "jq", "jsonPath"] };
    app.options("/meta_query", cors(metaQueryCorsOptions));
    app.post("/meta_query", cors(), rawBody, attachGraphiqlSession, proxyTo(metaQueryUrl));
  }

  // Registered last: GraphiQL's own catch-all (static assets + index.html)
  // would otherwise shadow nothing here since none of its own routes match
  // /graphql or /meta_query, but keeping it last avoids relying on that.
  app.use("/", GraphiQL(graphiqlOptions));

  return app;
}

module.exports = createApp;
