require("dotenv").config();

const createApp = require("./app");

const PORT = parseInt(process.env.PORT || "7070", 10);

// This app's own public origin - the one thing that must exactly match what's
// registered as the redirect URI on the Keycloak client. Defaults to
// http://localhost:<PORT>, so changing just PORT is enough for the common
// case; only set ORIGIN explicitly when that default is wrong (different
// host/protocol, e.g. behind a reverse proxy where PORT isn't the public one).
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;

// The graphql-server this GraphiQL deployment talks to - /graphql and
// /meta_query are both derived from this one origin.
const ZENDRO_SERVER_URL = process.env.ZENDRO_SERVER_URL;
const GRAPHQL_URL = ZENDRO_SERVER_URL && `${ZENDRO_SERVER_URL}/graphql`;
const FILTER_ENABLED = process.env.GRAPHIQL_FILTER_ENABLED === "true";
const METAQUERY_URL = FILTER_ENABLED && ZENDRO_SERVER_URL ? `${ZENDRO_SERVER_URL}/meta_query` : undefined;

const graphiqlOptions = {
  mountPath: "/",
  features: {
    auth: {
      enabled: true,
      clientId: process.env.OAUTH2_CLIENT_ID || "zendro_graphiql",
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      issuerUri: process.env.OAUTH2_ISSUER_URI,
      redirectUri: `${ORIGIN}/auth/callback`,
      sessionSecret: process.env.SESSION_SECRET,
    },
    filter: { enabled: Boolean(METAQUERY_URL) },
  },
};

const app = createApp({
  graphqlUrl: GRAPHQL_URL,
  metaQueryUrl: METAQUERY_URL,
  graphiqlOptions,
  maxBodySize: process.env.POST_REQUEST_MAX_BODY_SIZE,
});

const server = app.listen(PORT, () => {
  console.log(`GraphiQL listening on port ${PORT} (origin ${ORIGIN}), proxying to ${GRAPHQL_URL}`);
});

module.exports = server;
