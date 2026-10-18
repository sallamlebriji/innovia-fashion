import { createFalClient } from "@fal-ai/client";
import { HttpError } from "../errors.js";
export const model = "fal-ai/image-apps-v2/virtual-try-on";
export interface TryOnProvider {
  submit: (person: Buffer, clothingUrl: string) => Promise<string>;
  status: (id: string) => Promise<"PENDING" | "COMPLETED">;
  result: (id: string) => Promise<Buffer>;
  cancel: (id: string) => Promise<void>;
}
export function tryOnConfigured() {
  return !!process.env.FAL_KEY && process.env.AI_PROVIDER_APPROVED === "true";
}
async function downloadResult(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !(
      parsed.hostname === "fal.media" || parsed.hostname.endsWith(".fal.media")
    ) ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443")
  )
    throw new HttpError(
      502,
      "AI_OUTPUT_HOST",
      "The provider returned an unsupported result host.",
    );
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (
    !response.ok ||
    !response.body ||
    Number(response.headers.get("content-length") ?? 0) > 10 * 1024 * 1024
  )
    throw new HttpError(
      502,
      "AI_OUTPUT",
      "The generated image could not be downloaded within the size limit.",
    );
  const reader = response.body.getReader(),
    chunks: Buffer[] = [];
  let bytes = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 10 * 1024 * 1024) {
      await reader.cancel();
      throw new HttpError(
        502,
        "AI_OUTPUT_SIZE",
        "The generated image exceeds the supported size.",
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export function liveTryOnProvider(): TryOnProvider | null {
  if (!tryOnConfigured()) return null;
  const fal = createFalClient({
    credentials: process.env.FAL_KEY,
    fetch: async (url, options) => {
      // The SDK retries submissions by default. A submission with an uncertain
      // response must never create a second paid job.
      try {
        const response = await fetch(url, options);
        if (options?.method?.toUpperCase() === "POST" && !response.ok)
          throw new HttpError(
            502,
            "AI_SUBMISSION",
            "The provider rejected the fitting request.",
          );
        return response;
      } catch (error) {
        if (options?.method?.toUpperCase() === "POST")
          throw new HttpError(
            502,
            "AI_SUBMISSION_UNCERTAIN",
            "The fitting request could not be confirmed.",
          );
        throw error;
      }
    },
  });
  return {
    submit: async (person, clothingUrl) => {
      const result = await fal.queue.submit(model, {
        abortSignal: AbortSignal.timeout(30000),
        startTimeout: 120,
        input: {
          person_image_url: `data:image/webp;base64,${person.toString("base64")}`,
          clothing_image_url: clothingUrl,
          preserve_pose: true,
        },
      });
      return result.request_id;
    },
    status: async (id) => {
      const result = await fal.queue.status(model, {
        requestId: id,
        logs: false,
        abortSignal: AbortSignal.timeout(30000),
      });
      return result.status === "COMPLETED" ? "COMPLETED" : "PENDING";
    },
    result: async (id) => {
      const result = await fal.queue.result(model, {
        requestId: id,
        abortSignal: AbortSignal.timeout(30000),
      });
      const data = result.data as { images?: { url?: string }[] };
      const url = data.images?.[0]?.url;
      if (!url)
        throw new HttpError(
          502,
          "AI_OUTPUT",
          "The provider returned no generated image.",
        );
      return downloadResult(url);
    },
    cancel: async (id) => {
      await fal.queue.cancel(model, {
        requestId: id,
        abortSignal: AbortSignal.timeout(30000),
      });
    },
  };
}
