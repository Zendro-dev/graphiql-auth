require("dotenv").config();

const createApp = require("./app");

const PORT = parseInt(process.env.PORT || "7070", 10);

// This app's own public origin - used only to tell graphql-server which
// origin to run login/logout on behalf of (see ZENDRO_AUTH_PATH below).
// Defaults to http://localhost:<PORT>, so changing just PORT is enough for
// the common case; only set ORIGIN explicitly when that default is wrong
// (different host/protocol, e.g. behind a reverse proxy where PORT isn't
// the public one).
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;

// The graphql-server this GraphiQL deployment talks to - /graphql,
// /meta_query and /auth/* are all derived from this one origin. gqs is the
// only service with real Keycloak credentials: it must be registered
// (AUTH_REDIRECT_URI on gqs's own .env) to allow running login on this
// app's behalf - see zendro-graphiql's README, "Acting as an auth backend
// for other origins".
const ZENDRO_SERVER_URL = process.env.ZENDRO_SERVER_URL;
const GRAPHQL_URL = ZENDRO_SERVER_URL && `${ZENDRO_SERVER_URL}/graphql`;
const FILTER_ENABLED = process.env.GRAPHIQL_FILTER_ENABLED === "true";
const METAQUERY_URL = FILTER_ENABLED && ZENDRO_SERVER_URL ? `${ZENDRO_SERVER_URL}/meta_query` : undefined;
// Where gqs runs its top-level auth backend (see gqs's own utils/auth) - a
// fixed path, independent of gqs's own GraphiQL mount; only worth
// overriding if something in front of gqs rewrites it.
const AUTH_PATH = process.env.ZENDRO_AUTH_PATH || "/auth";
const AUTH_BASE_URL = ZENDRO_SERVER_URL && `${ZENDRO_SERVER_URL}${AUTH_PATH}`;

// This app holds no Keycloak credentials of its own - /auth/* is
// reverse-proxied to gqs below (see proxyAuthTo in app.js). Only the
// login/logout UI is rendered here.
const graphiqlOptions = {
  features: {
    auth: true,
    filter: Boolean(METAQUERY_URL),
  },
};

const app = createApp({
  graphqlUrl: GRAPHQL_URL,
  metaQueryUrl: METAQUERY_URL,
  authBaseUrl: AUTH_BASE_URL,
  redirectUri: `${ORIGIN}/auth/callback`,
  graphiqlOptions,
  maxBodySize: process.env.POST_REQUEST_MAX_BODY_SIZE,
});

const server = app.listen(PORT, () => {
  console.log(`GraphiQL listening on port ${PORT} (origin ${ORIGIN}), proxying to ${GRAPHQL_URL}`);
});

module.exports = server;
