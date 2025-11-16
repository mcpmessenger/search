"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const PORT = process.env.PORT || 8001;
const server = http_1.default.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/invoke") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
            try {
                const invocation = JSON.parse(body || "{}");
                const command = invocation.command ?? "web_search";
                if (command !== "web_search") {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        result: {
                            type: "error",
                            message: `Unsupported command: ${command}`,
                        },
                    }));
                    return;
                }
                const query = invocation.args?.query;
                const maxResults = Number(invocation.args?.max_results ?? 5) || 5;
                if (!query) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        result: {
                            type: "error",
                            message: "Missing required parameter: query",
                        },
                    }));
                    return;
                }
                // TODO: plug in real search; placeholder returns echo
                const results = [
                    {
                        title: `Result for "${query}"`,
                        url: "https://example.com",
                        snippet: "Replace this with a real search implementation.",
                    },
                ].slice(0, maxResults);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    result: {
                        type: "json",
                        data: { query, maxResults, results },
                        summary: `Top ${results.length} placeholder results for "${query}".`,
                    },
                }));
            }
            catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    result: {
                        type: "error",
                        message: "Internal error",
                        details: String(err),
                    },
                }));
            }
        });
    }
    else {
        res.writeHead(404);
        res.end();
    }
});
server.listen(PORT, () => {
    console.log(`search-mcp listening on http://localhost:${PORT}/invoke`);
});
//# sourceMappingURL=index.js.map