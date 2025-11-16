"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
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
                // Call DuckDuckGo Instant Answer API
                const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
                // Use Node's https module instead of fetch for compatibility
                const data = await new Promise((resolve, reject) => {
                    https_1.default
                        .get(ddgUrl, (response) => {
                        let body = "";
                        response.on("data", (chunk) => (body += chunk));
                        response.on("end", () => {
                            if (response.statusCode !== 200) {
                                reject(new Error(`DuckDuckGo request failed with status ${response.statusCode}`));
                                return;
                            }
                            try {
                                resolve(JSON.parse(body));
                            }
                            catch (err) {
                                reject(new Error(`Failed to parse JSON: ${err}`));
                            }
                        });
                    })
                        .on("error", (err) => {
                        reject(new Error(`Request failed: ${err.message}`));
                    });
                });
                const results = [];
                // Use Abstract as a first result when present
                if (data.Abstract && data.AbstractURL) {
                    results.push({
                        title: data.Heading || data.AbstractText || query,
                        url: data.AbstractURL,
                        snippet: data.Abstract,
                    });
                }
                const related = Array.isArray(data.RelatedTopics)
                    ? data.RelatedTopics
                    : [];
                const pushTopic = (topic) => {
                    if (!topic || (!topic.Text && !topic.FirstURL))
                        return;
                    results.push({
                        title: topic.Text || topic.FirstURL || query,
                        url: topic.FirstURL || data.AbstractURL || "https://duckduckgo.com",
                        snippet: topic.Text || "",
                    });
                };
                for (const topic of related) {
                    if (topic && Array.isArray(topic.Topics)) {
                        for (const sub of topic.Topics) {
                            pushTopic(sub);
                            if (results.length >= maxResults)
                                break;
                        }
                    }
                    else {
                        pushTopic(topic);
                    }
                    if (results.length >= maxResults)
                        break;
                }
                const limitedResults = results.slice(0, maxResults);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    result: {
                        type: "json",
                        data: { query, maxResults, results: limitedResults },
                        summary: `Top ${limitedResults.length} DuckDuckGo results for "${query}".`,
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