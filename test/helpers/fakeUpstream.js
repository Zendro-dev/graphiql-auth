const http = require("node:http");

// A fake graphql-server: records every request it receives so tests can
// assert on what the proxy actually forwarded.
function startFakeUpstream(responder) {
  return new Promise((resolve) => {
    const requests = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        requests.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
        responder(req, res);
      });
    });
    server.listen(0, () => resolve({ server, requests, url: `http://localhost:${server.address().port}` }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

module.exports = { startFakeUpstream, closeServer };
