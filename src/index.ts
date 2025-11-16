import http, { IncomingMessage, ServerResponse } from "http";

const PORT = process.env.PORT || 8001;

type Invocation = {
  command?: string;
  args?: Record<string, string>;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const server = http.createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "POST" && req.url === "/invoke") {
    let body = "";

    req.on("data", (chunk: Buffer) => (body += chunk));

    req.on("end", async () => {
      try {
        const invocation = JSON.parse(body || "{}") as Invocation;
        const command = invocation.command ?? "web_search";

        if (command !== "web_search") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              result: {
                type: "error",
                message: `Unsupported command: ${command}`,
              },
            }),
          );
          return;
        }

        const query = invocation.args?.query;
        const maxResults = Number(invocation.args?.max_results ?? 5) || 5;

        if (!query) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              result: {
                type: "error",
                message: "Missing required parameter: query",
              },
            }),
          );
          return;
        }

        // Call DuckDuckGo Instant Answer API
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
          query,
        )}&format=json&no_redirect=1&no_html=1`;

        const response = await fetch(ddgUrl);

        if (!response.ok) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              result: {
                type: "error",
                message: `DuckDuckGo request failed with status ${response.status}`,
              },
            }),
          );
          return;
        }

        const data = (await response.json()) as any;

        const results: SearchResult[] = [];

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

        const pushTopic = (topic: any) => {
          if (!topic || (!topic.Text && !topic.FirstURL)) return;
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
              if (results.length >= maxResults) break;
            }
          } else {
            pushTopic(topic);
          }
          if (results.length >= maxResults) break;
        }

        const limitedResults = results.slice(0, maxResults);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            result: {
              type: "json",
              data: { query, maxResults, results: limitedResults },
              summary: `Top ${limitedResults.length} DuckDuckGo results for "${query}".`,
            },
          }),
        );
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            result: {
              type: "error",
              message: "Internal error",
              details: String(err),
            },
          }),
        );
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`search-mcp listening on http://localhost:${PORT}/invoke`);
});


