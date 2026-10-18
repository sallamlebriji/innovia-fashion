"use client";
import { useEffect, useRef, useState } from "react";
import type { CameraKitSession } from "@snap/camera-kit";
type Capability = {
  enabled: boolean;
  apiToken?: string;
  lensId?: string;
  groupId?: string;
};
export function LiveAR({
  slug,
  productId,
}: {
  slug: string;
  productId: string;
}) {
  const [capability, setCapability] = useState<Capability>(),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream>(null),
    session = useRef<CameraKitSession>(null),
    generation = useRef(0);
  const stop = () => {
    generation.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    session.current?.destroy();
    session.current = null;
    setRunning(false);
  };
  useEffect(() => {
    let current = true;
    fetch(
      `/api/v1/storefront/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/ar`,
      { cache: "no-store" },
    )
      .then(async (response) =>
        response.ok ? response.json() : { enabled: false },
      )
      .then((data) => {
        if (current) setCapability(data);
      })
      .catch(() => {});
    return () => {
      current = false;
      stop();
    };
  }, [slug, productId]);
  async function start() {
    stop();
    setError("");
    setPending(true);
    const attempt = ++generation.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Live AR needs a supported browser and a secure connection. You can use photo fitting instead.",
        );
      if (!document.createElement("canvas").getContext("webgl2"))
        throw new Error(
          "This device does not support the AR renderer. Try photo fitting instead.",
        );
      const sdk = await import("@snap/camera-kit"),
        kit = await sdk.bootstrapCameraKit({ apiToken: capability!.apiToken! });
      if (attempt !== generation.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (attempt !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const active = await kit.createSession({
        liveRenderTarget: canvas.current!,
      });
      if (attempt !== generation.current) {
        active.destroy();
        return;
      }
      session.current = active;
      await active.setSource(
        sdk.createMediaStreamSource(media, { cameraType: "environment" }),
      );
      const lens = await kit.lensRepository.loadLens(
        capability!.lensId!,
        capability!.groupId!,
      );
      if (attempt !== generation.current) {
        active.destroy();
        return;
      }
      active.events.addEventListener("error", () => {
        setError(
          "This lens cannot run on your device. Try photo fitting instead.",
        );
        stop();
      });
      await active.applyLens(lens);
      if (attempt !== generation.current) {
        active.destroy();
        return;
      }
      await active.play();
      if (attempt !== generation.current) {
        active.destroy();
        return;
      }
      setRunning(true);
    } catch (err) {
      if (attempt !== generation.current) return;
      stop();
      setError(
        err instanceof Error
          ? err.message
          : "AR could not start. Try photo fitting instead.",
      );
    } finally {
      setPending(false);
    }
  }
  if (!capability?.enabled) return null;
  return (
    <section>
      <button className="account-text-button" onClick={() => setOpen(true)}>
        Explore with your camera
      </button>
      {open && (
        <div className="live-ar-panel">
          <h3>Your live fitting preview</h3>
          <p>
            The camera is used by Snap Camera Kit to render the boutique’s
            licensed lens. This visual preview does not predict size or
            guarantee fit.
          </p>
          <canvas ref={canvas} aria-label="Live AR fitting preview" />
          <button
            className="store-cta dark"
            disabled={pending || running}
            onClick={start}
          >
            {pending
              ? "Opening your camera…"
              : running
                ? "Camera active"
                : "Allow camera and start"}
          </button>
          <button
            className="account-text-button"
            onClick={() => {
              stop();
              setOpen(false);
            }}
          >
            Close camera
          </button>
          {error && (
            <p role="alert" className="store-error">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
