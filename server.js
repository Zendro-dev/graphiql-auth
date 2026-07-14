require("dotenv").config();

const createApp = require("./app");

const PORT = parseInt(process.env.PORT || "7070", 10);
const GRAPHQL_URL = process.env.ZENDRO_GRAPHQL_URL;
const METAQUERY_URL = process.env.ZENDRO_METAQUERY_URL;

const graphiqlOptions = {
  mountPath: "/",
  features: {
    auth: {
      enabled: true,
      clientId: process.env.OAUTH2_CLIENT_ID || "zendro_graphiql",
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      issuerUri: process.env.OAUTH2_ISSUER_URI,
      redirectUri: process.env.OAUTH2_REDIRECT_URI,
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
  console.log(`GraphiQL listening on port ${PORT}, proxying to ${GRAPHQL_URL}`);
});

module.exports = server;
