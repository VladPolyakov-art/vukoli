/* US-23 AC4: is the data folder writable? The server writes and removes a small file (GET /api/health -> storage_ok).
 * Asked once when a screen mounts; true until the server says otherwise, so a slow or old server never raises the alarm. */
import { useEffect, useState } from "react";
import { api } from "./api";

export function useStorageWritable(): boolean {
  const [writable, setWritable] = useState(true);
  useEffect(() => {
    let alive = true;
    api.health().then((h) => { if (alive && h.storage_ok === false) setWritable(false); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return writable;
}
