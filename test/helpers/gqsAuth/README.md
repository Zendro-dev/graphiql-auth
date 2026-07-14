# gqsAuth test fixture

A test-only duplicate of `graphql-server/utils/auth/` (`cookies.js`,
`oidc.js`, `router.js`, `session.js`), used only to stand in for a real gqs
in this app's own tests (`test/app.test.js`'s `startFakeGqs()`,
`test/extra/live-login.test.js`'s `startGqsStandin()`).

This app never runs an OAuth2 flow itself - it only reverse-proxies
`/auth/*` to gqs (see `app.js`'s `proxyAuthTo`). But testing that proxy
behavior properly (redirect handling, cookie forwarding, the
`X-Zendro-Auth-Redirect-Uri` override, and - for the live test - a real
Keycloak round trip) needs something on the other end that actually
behaves like gqs, not a trivial stub. Since `graphiql-auth` and
`graphql-server` are separate repos with no runtime dependency on each
other, this is a deliberate, test-only duplicate rather than a cross-repo
import.

**If `graphql-server/utils/auth/` changes, this fixture should be updated
to match** - it's meant to track that implementation, not diverge from it.
