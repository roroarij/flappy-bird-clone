const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const root = __dirname;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

http
  .createServer((req, res) => {
    const pathname = req.url === "/" ? "/index.html" : req.url;
    const safePath = path.normalize(path.join(root, pathname));

    if (!safePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(safePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const extension = path.extname(safePath);
      res.writeHead(200, {
        "Content-Type": types[extension] || "application/octet-stream",
        "Cache-Control": "no-cache"
      });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`Static server running at http://${host}:${port}`);
  });
