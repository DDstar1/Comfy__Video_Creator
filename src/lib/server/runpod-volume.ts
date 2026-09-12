import "server-only";
import { createHash, createHmac } from "node:crypto";

// Reads a chain's already-rendered video straight off the RunPod Network
// Volume, over its S3-compatible API, without going through a RunPod job.
//
// This exists because a generation job's own /status result expires roughly
// 30 minutes after completion, but the video survives indefinitely: the
// Extender's disk cache writes one file per clip position in the chain to
// <volume>/comfytr-cache/<sha256 of cache_namespace>/chain_extender_1.final.video/ref2va_NNNN.<ext>,
// confirmed by listing the volume directly -- this workflow never populates
// the different "live preview" file the vendored node also supports.
//
// RunPod's S3 endpoint does not support presigned query-string URLs (verified:
// a signed GET with no Authorization header returns 401 "missing Authorization
// header"), so every request, including this module's, must carry a full SigV4
// header signature. That also means we can only ever get bytes here, never a
// link handed to the browser.
//
// A chain with more than one clip needs its segments joined with ffmpeg, which
// this server does not have; that case is left to the caller, which falls back
// to the worker's "fetch" job for exactly that reason.

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured on this deployment.`);
  return value;
}

function config() {
  return {
    accessKey: requireEnv("RUNPOD_S3_STORAGE_ACCESS_KEY"),
    secretKey: requireEnv("RUNPOD_S3_STORAGE_API_KEY"),
    volumeId: requireEnv("RUNPOD_S3_VOLUME_ID"),
    region: requireEnv("RUNPOD_S3_REGION"),
  };
}

function host(region: string) {
  return `s3api-${region.toLowerCase()}.runpod.io`;
}

function sha256Hex(data: string | Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data).digest();
}

function encodeSegment(segment: string) {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/** SigV4-sign one request against the volume's S3-compatible API and send it. */
async function signedRequest(
  method: "GET",
  objectKey: string,
  query: Record<string, string> = {},
) {
  const { accessKey, secretKey, volumeId, region } = config();
  const hostname = host(region);
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.slice(0, 8);
  const canonicalUri =
    "/" +
    volumeId +
    (objectKey ? "/" + objectKey.split("/").map(encodeSegment).join("/") : "");
  const payloadHash = sha256Hex("");
  const qs = Object.keys(query)
    .sort()
    .map((k) => `${encodeSegment(k)}=${encodeSegment(query[k])}`)
    .join("&");
  const canonicalHeaders = `host:${hostname}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    qs,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${datestamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzdate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  let key: Buffer | string = `AWS4${secretKey}`;
  for (const part of [datestamp, region, "s3", "aws4_request"]) key = hmac(key, part);
  const signature = hmac(key, stringToSign).toString("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${hostname}${canonicalUri}${qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      Authorization: authorization,
      "x-amz-date": amzdate,
      "x-amz-content-sha256": payloadHash,
    },
    cache: "no-store",
  });
}

function chainDigest(cacheNamespace: string) {
  return sha256Hex(cacheNamespace);
}

function chainPrefix(cacheNamespace: string) {
  const digest = chainDigest(cacheNamespace);
  return `comfytr-cache/${digest.slice(0, 2)}/${digest}/chain_extender_1.final.video/`;
}

/**
 * List a chain's per-clip-position video segments, in order. Returns an empty
 * array when the chain is not on this volume -- a truncated or evicted cache,
 * exactly as the worker's own recovery path treats it.
 */
export async function listChainSegments(cacheNamespace: string) {
  const prefix = chainPrefix(cacheNamespace);
  const response = await signedRequest("GET", "", {
    "list-type": "2",
    "max-keys": "1000",
    prefix,
  });
  if (response.status === 404) return [];
  const body = await response.text();
  if (!response.ok)
    throw new Error(`Volume listing failed (${response.status}): ${body.slice(0, 200)}`);
  const keys = [...body.matchAll(/<Key>([^<]*)<\/Key>/g)]
    .map((m) => m[1])
    .filter((key) => key.startsWith(prefix) && key.length > prefix.length);
  // Object keys returned here are already bucket-relative, matching what
  // getVolumeObject expects as its `key` argument.
  return keys
    .map((key) => {
      const match = /ref2va_(\d+)\./.exec(key.slice(prefix.length));
      return { key, index: match ? Number(match[1]) : -1 };
    })
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.key);
}

/** Download one object's bytes from the volume. */
export async function getVolumeObject(key: string): Promise<Uint8Array> {
  const response = await signedRequest("GET", key);
  if (!response.ok)
    throw new Error(`Volume read failed (${response.status}) for ${key}`);
  return new Uint8Array(await response.arrayBuffer());
}
