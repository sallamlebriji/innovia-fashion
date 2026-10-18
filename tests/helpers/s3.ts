import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { StorageEnvironment } from "@innovia/media-storage";
export async function s3Fixture(onWrite?: (key: string) => Promise<void>) {
  const objects = new Map<string, { data: Buffer; hash: string }>();
  const requests: {
    method: string;
    path: string;
    conditional?: string;
    encryption?: string;
    acl?: string;
  }[] = [];
  const state = {
    failWrites: false,
    conflictWrites: false,
    failDeletes: false,
    corruptRead: false,
    oversizedRead: false,
    repeatedPage: false,
    versioning: "" as "" | "Enabled" | "Suspended",
    failVersioning: false,
  };
  const failures: unknown[] = [];
  const error = (res: ServerResponse, status: number, code: string) => {
    res.writeHead(status, { "content-type": "application/xml" });
    res.end(
      `<Error><Code>${code}</Code><Message>Fixture rejection</Message></Error>`,
    );
  };
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url!, "http://localhost");
    requests.push({
      method: req.method!,
      path: url.pathname,
      conditional: req.headers["if-none-match"],
      encryption: req.headers["x-amz-server-side-encryption"] as
        string | undefined,
      acl: req.headers["x-amz-acl"] as string | undefined,
    });
    if (!req.headers.authorization?.startsWith("AWS4-HMAC-SHA256"))
      return error(res, 403, "AccessDenied");
    if (req.method === "GET" && url.searchParams.has("versioning")) {
      if (state.failVersioning) return error(res, 403, "AccessDenied");
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(
        `<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${state.versioning ? `<Status>${state.versioning}</Status>` : ""}</VersioningConfiguration>`,
      );
      return;
    }
    if (req.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") || "",
        all = [...objects.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort();
      const start = Number(
          (url.searchParams.get("continuation-token") || "cursor-0").replace(
            "cursor-",
            "",
          ),
        ),
        page = all.slice(start, start + 1),
        truncated = start + 1 < all.length;
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(
        `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>test-bucket</Name><Prefix>${prefix}</Prefix><IsTruncated>${state.repeatedPage || truncated}</IsTruncated>${state.repeatedPage || truncated ? `<NextContinuationToken>cursor-${state.repeatedPage ? 1 : start + 1}</NextContinuationToken>` : ""}${page.map((key) => `<Contents><Key>${key}</Key><Size>${objects.get(key)!.data.length}</Size></Contents>`).join("")}</ListBucketResult>`,
      );
      return;
    }
    const key = decodeURIComponent(
      url.pathname.replace(/^\/test-bucket\//, ""),
    );
    if (req.method === "PUT") {
      if (req.headers["if-none-match"] !== "*")
        return error(res, 400, "InvalidRequest");
      if (state.conflictWrites) {
        objects.set(key, { data: Buffer.from("pre-existing image"), hash: "" });
        return error(res, 412, "PreconditionFailed");
      }
      if (objects.has(key)) return error(res, 412, "PreconditionFailed");
      if (onWrite) await onWrite(key);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      objects.set(key, {
        data: Buffer.concat(chunks),
        hash: req.headers["x-amz-meta-sha256"] as string,
      });
      if (state.failWrites) return error(res, 500, "InternalError");
      res.writeHead(200, { etag: '"fixture"' });
      res.end();
      return;
    }
    if (req.method === "GET") {
      const value = objects.get(key);
      if (!value) return error(res, 404, "NoSuchKey");
      res.writeHead(200, {
        "content-type": "image/webp",
        "content-length": state.oversizedRead
          ? 11 * 1024 * 1024
          : value.data.length,
        "x-amz-meta-sha256": state.corruptRead ? "0".repeat(64) : value.hash,
      });
      res.end(value.data);
      return;
    }
    if (req.method === "DELETE") {
      if (state.failDeletes) return error(res, 503, "ServiceUnavailable");
      objects.delete(key);
      res.writeHead(204);
      res.end();
      return;
    }
    error(res, 400, "InvalidRequest");
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      failures.push(err);
      if (!res.headersSent) error(res, 500, "InternalError");
      else res.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const env: StorageEnvironment = {
    NODE_ENV: "test",
    MEDIA_STORAGE: "s3",
    MEDIA_S3_BUCKET: "test-bucket",
    MEDIA_S3_REGION: "us-east-1",
    MEDIA_S3_ENDPOINT: endpoint,
    MEDIA_S3_PREFIX: "innovia",
    MEDIA_S3_FORCE_PATH_STYLE: "true",
    AWS_ACCESS_KEY_ID: "test-access-key",
    AWS_SECRET_ACCESS_KEY: "test-only-secret",
    MEDIA_S3_ENCRYPTION: "AES256",
  };
  return {
    objects,
    requests,
    state,
    failures,
    env,
    endpoint,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}
