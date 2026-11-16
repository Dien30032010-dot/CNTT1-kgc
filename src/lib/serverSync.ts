import {
  getLastSyncedServerTs,
  getLocalUpdatedAt,
  hasCustomData,
  normalizeDatabase,
  saveDatabase,
  setLastSyncedServerTs,
  setLocalUpdatedAt,
} from "../data/defaults";
import type { ClassDatabase } from "../types";

export interface ServerSnapshotResponse {
  exists: boolean;
  updatedAt: number;
  lastSender?: string;
  data: ClassDatabase | null;
}

export type SyncAction = "imported" | "exported" | "up-to-date" | "offline";

export interface SyncOnLoadResult {
  action: SyncAction;
  db: ClassDatabase;
  updatedAt: number;
}

export async function fetchServerSnapshot(): Promise<ServerSnapshotResponse> {
  const res = await fetch("/api/class-data", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Không thể đọc dữ liệu từ máy chủ.");
  }
  const payload = (await res.json()) as {
    exists?: boolean;
    updatedAt?: number;
    lastSender?: string;
    data?: Partial<ClassDatabase> | null;
  };
  if (!payload.exists || !payload.data || !Array.isArray(payload.data.students)) {
    return {
      exists: false,
      updatedAt: 0,
      data: null,
    };
  }
  return {
    exists: true,
    updatedAt:
      typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt)
        ? payload.updatedAt
        : Date.now(),
    lastSender: payload.lastSender,
    data: normalizeDatabase(payload.data),
  };
}

export async function pushDatabaseToServer(
  db: ClassDatabase,
  updatedAt?: number,
  sender?: string
): Promise<{ ok: boolean; updatedAt: number; mergedDb?: ClassDatabase }> {
  const ts = updatedAt ?? Date.now();
  try {
    const res = await fetch("/api/class-data/merge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baseUpdatedAt: getLastSyncedServerTs(),
        sender,
        data: db,
      }),
    });
    if (!res.ok) {
      return { ok: false, updatedAt: ts };
    }
    const result = (await res.json()) as {
      ok?: boolean;
      updatedAt?: number;
      data?: Partial<ClassDatabase>;
    };
    const finalTs =
      typeof result.updatedAt === "number" && Number.isFinite(result.updatedAt)
        ? result.updatedAt
        : ts;
    setLocalUpdatedAt(finalTs);
    setLastSyncedServerTs(finalTs);
    const mergedDb =
      result.data && Array.isArray(result.data.students)
        ? normalizeDatabase(result.data)
        : undefined;
    return { ok: Boolean(result.ok), updatedAt: finalTs, mergedDb };
  } catch {
    return { ok: false, updatedAt: ts };
  }
}

export async function sendToServerAndMerge(
  db: ClassDatabase,
  sender?: string
): Promise<{ db: ClassDatabase; updatedAt: number; lastSender: string }> {
  const res = await fetch("/api/class-data/merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      baseUpdatedAt: getLastSyncedServerTs(),
      sender,
      data: db,
    }),
  });

  if (!res.ok) {
    throw new Error("Không thể gửi dữ liệu lên máy chủ.");
  }

  const result = (await res.json()) as {
    ok?: boolean;
    updatedAt?: number;
    lastSender?: string;
    data?: Partial<ClassDatabase>;
  };

  if (!result.data || !Array.isArray(result.data.students)) {
    throw new Error("Phản hồi từ máy chủ không hợp lệ.");
  }

  const finalTs =
    typeof result.updatedAt === "number" && Number.isFinite(result.updatedAt)
      ? result.updatedAt
      : Date.now();
  const mergedDb = normalizeDatabase(result.data);
  saveDatabase(mergedDb);
  setLocalUpdatedAt(finalTs);
  setLastSyncedServerTs(finalTs);

  return {
    db: mergedDb,
    updatedAt: finalTs,
    lastSender: result.lastSender ?? "",
  };
}

export async function syncWithServerOnLoad(
  currentDb: ClassDatabase
): Promise<SyncOnLoadResult> {
  const localTs = getLocalUpdatedAt();
  try {
    const server = await fetchServerSnapshot();

    if (!server.exists || !server.data) {
      const pushTs = localTs > 0 ? localTs : Date.now();
      const pushed = await pushDatabaseToServer(currentDb, pushTs);
      return {
        action: pushed.ok ? "exported" : "offline",
        db: pushed.mergedDb ?? currentDb,
        updatedAt: pushed.updatedAt,
      };
    }

    if (localTs === 0 && hasCustomData(currentDb) && !hasCustomData(server.data)) {
      const pushed = await pushDatabaseToServer(currentDb, Date.now());
      return {
        action: pushed.ok ? "exported" : "offline",
        db: pushed.mergedDb ?? currentDb,
        updatedAt: pushed.updatedAt,
      };
    }

    if (localTs === 0 || server.updatedAt > localTs) {
      saveDatabase(server.data);
      setLocalUpdatedAt(server.updatedAt);
      setLastSyncedServerTs(server.updatedAt);
      return {
        action: "imported",
        db: server.data,
        updatedAt: server.updatedAt,
      };
    }

    if (localTs > server.updatedAt) {
      const pushed = await pushDatabaseToServer(currentDb, localTs);
      return {
        action: pushed.ok ? "exported" : "offline",
        db: pushed.mergedDb ?? currentDb,
        updatedAt: pushed.updatedAt,
      };
    }

    setLastSyncedServerTs(server.updatedAt);
    return {
      action: "up-to-date",
      db: currentDb,
      updatedAt: server.updatedAt,
    };
  } catch {
    return {
      action: "offline",
      db: currentDb,
      updatedAt: localTs,
    };
  }
}

export function triggerJsonFileDownload(
  rawJsonText: string,
  filename = "CNTT1-9K7-backup.json"
): void {
  const blob = new Blob([rawJsonText], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAndAutoImportFromServer(
  currentDb: ClassDatabase,
  options?: { downloadFile?: boolean; pushLocalFirst?: boolean }
): Promise<{ db: ClassDatabase; updatedAt: number; downloaded: boolean }> {
  const localTs = getLocalUpdatedAt();
  const serverBefore = await fetchServerSnapshot();

  if (
    !serverBefore.exists ||
    options?.pushLocalFirst ||
    localTs > serverBefore.updatedAt
  ) {
    const pushTs = localTs > serverBefore.updatedAt ? localTs : Date.now();
    await pushDatabaseToServer(currentDb, pushTs);
  }

  const res = await fetch("/api/class-data/export", {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Không thể xuất dữ liệu JSON từ máy chủ.");
  }

  const rawText = await res.text();
  const parsed = JSON.parse(rawText) as Partial<ClassDatabase>;
  if (!parsed || !Array.isArray(parsed.students)) {
    throw new Error("Dữ liệu JSON từ máy chủ không hợp lệ.");
  }

  const headerTs = Number(res.headers.get("X-Data-Updated-At") || "0");
  const finalTs =
    Number.isFinite(headerTs) && headerTs > 0 ? headerTs : Date.now();

  let downloaded = false;
  if (options?.downloadFile !== false) {
    triggerJsonFileDownload(rawText, "CNTT1-9K7-backup.json");
    downloaded = true;
  }

  const importedDb = normalizeDatabase(parsed);
  saveDatabase(importedDb);
  setLocalUpdatedAt(finalTs);
  setLastSyncedServerTs(finalTs);

  return {
    db: importedDb,
    updatedAt: finalTs,
    downloaded,
  };
}

export async function importFromServer(
  fallbackDb?: ClassDatabase
): Promise<{ db: ClassDatabase; updatedAt: number }> {
  let res = await fetch("/api/class-data/export", {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 404 && fallbackDb) {
    await pushDatabaseToServer(fallbackDb, Date.now());
    res = await fetch("/api/class-data/export", {
      method: "GET",
      cache: "no-store",
    });
  }

  if (!res.ok) {
    throw new Error("Không thể nhập dữ liệu JSON từ máy chủ.");
  }

  const rawText = await res.text();
  const parsed = JSON.parse(rawText) as Partial<ClassDatabase>;
  if (!parsed || !Array.isArray(parsed.students)) {
    throw new Error("Dữ liệu JSON từ máy chủ không hợp lệ.");
  }

  const headerTs = Number(res.headers.get("X-Data-Updated-At") || "0");
  const finalTs =
    Number.isFinite(headerTs) && headerTs > 0 ? headerTs : Date.now();

  const importedDb = normalizeDatabase(parsed);
  saveDatabase(importedDb);
  setLocalUpdatedAt(finalTs);
  setLastSyncedServerTs(finalTs);

  return {
    db: importedDb,
    updatedAt: finalTs,
  };
}
