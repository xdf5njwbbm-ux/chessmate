import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const BUCKET = "photos";
const TTL_S = 3600;

// Signed URLs are cached and batched so a feed of 20 profiles is one request.
const cache = new Map<string, { url: string; exp: number }>();
const waiting = new Map<string, ((u: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = new Map(waiting);
  waiting.clear();
  const paths = [...batch.keys()];
  if (!paths.length) return;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, TTL_S);
  const exp = Date.now() + (TTL_S - 120) * 1000;
  for (const p of paths) {
    const hit = data?.find((d) => d.path === p && d.signedUrl);
    if (hit?.signedUrl) cache.set(p, { url: hit.signedUrl, exp });
    for (const resolve of batch.get(p) ?? []) resolve(hit?.signedUrl ?? null);
  }
}

function cached(path: string): string | null {
  const c = cache.get(path);
  return c && c.exp > Date.now() ? c.url : null;
}

export function signedUrl(path: string): Promise<string | null> {
  const c = cached(path);
  if (c) return Promise.resolve(c);
  return new Promise((resolve) => {
    const list = waiting.get(path) ?? [];
    list.push(resolve);
    waiting.set(path, list);
    if (!timer) timer = setTimeout(flush, 16);
  });
}

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? cached(path) : null));
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    const c = cached(path);
    if (c) {
      setUrl(c);
      return;
    }
    signedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

/** Resize to at most 1440px on the long edge and re-encode as JPEG (also strips EXIF/GPS). */
export async function prepareImage(file: File): Promise<Blob> {
  const MAX = 1440;
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That file doesn't look like an image."));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (w < 200 || h < 200) throw new Error("That photo is too small. Please choose a larger one.");
  const scale = Math.min(1, MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process that photo.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Your browser couldn't process that photo.");
  return blob;
}

export async function uploadPhoto(uid: string, file: File): Promise<string> {
  const blob = await prepareImage(file);
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload failed. Please try again.");
  return path;
}

export async function deletePhotos(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
  paths.forEach((p) => cache.delete(p));
}

export async function deleteAllMyPhotos(uid: string) {
  const { data } = await supabase.storage.from(BUCKET).list(uid, { limit: 100 });
  const paths = (data ?? []).map((f) => `${uid}/${f.name}`);
  await deletePhotos(paths);
}
