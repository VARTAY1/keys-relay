// Tiny relay: forwards already-signed exchange API calls from the shop's Worker to the exchange,
// from a region the exchange accepts. Holds no keys of its own; every request must carry the shared relay key.
const http = require("http");

const RELAY_KEY = process.env.RELAY_KEY || "";
const HOSTS = new Set(["api.binance.com", "api1.binance.com", "bpay.binanceapi.com"]);
const PASS = /^(x-mbx-apikey|content-type|binancepay-.*)$/i;

http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://relay");
      if (u.pathname === "/health") return void res.end("ok");
      if (!RELAY_KEY || req.headers["x-relay-key"] !== RELAY_KEY) return void (res.writeHead(401), res.end());
      const host = u.searchParams.get("h") || "api.binance.com";
      const target = u.searchParams.get("u") || "";
      if (!HOSTS.has(host) || !target.startsWith("/")) return void (res.writeHead(400), res.end("bad target"));
      let body = "";
      for await (const c of req) body += c;
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) if (PASS.test(k) && typeof v === "string") headers[k] = v;
      const r = await fetch(`https://${host}${target}`, { method: req.method, headers, body: body || undefined });
      const text = await r.text();
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
      res.end(text);
    } catch (e) {
      res.writeHead(502);
      res.end(JSON.stringify({ relay_error: String(e && e.message) }));
    }
  })
  .listen(process.env.PORT || 10000);
