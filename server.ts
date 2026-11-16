import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "cntt1-data.json");

interface ServerSnapshot {
  updatedAt: number;
  lastSender?: string;
  data: Record<string, unknown>;
}

let cachedSnapshot: ServerSnapshot | null = null;

async function readSnapshotFromDisk(): Promise<ServerSnapshot | null> {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ServerSnapshot> & Record<string, unknown>;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.data &&
      typeof parsed.data === "object" &&
      Array.isArray((parsed.data as Record<string, unknown>).students)
    ) {
      cachedSnapshot = {
        updatedAt:
          typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
            ? parsed.updatedAt
            : Date.now(),
        lastSender:
          typeof parsed.lastSender === "string" ? parsed.lastSender : undefined,
        data: parsed.data as Record<string, unknown>,
      };
      return cachedSnapshot;
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.students)) {
      cachedSnapshot = {
        updatedAt: Date.now(),
        data: parsed,
      };
      return cachedSnapshot;
    }
  } catch {
    // No snapshot saved on disk yet
  }
  return null;
}

async function writeSnapshotToDisk(snapshot: ServerSnapshot): Promise<void> {
  cachedSnapshot = snapshot;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(snapshot, null, 2), "utf8");
    await fs.rename(tempFile, DATA_FILE);
  } catch {
    // Keep in-memory snapshot if filesystem is read-only
  }
}

function asRecordArray(val: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
}

function mergeById(
  serverVal: unknown,
  incomingVal: unknown,
  deletedIds: Set<string>,
  preferIncomingOnMatch: boolean
): Array<Record<string, unknown>> {
  const serverArr = asRecordArray(serverVal);
  const incomingArr = asRecordArray(incomingVal);
  const merged = new Map<string, Record<string, unknown>>();

  for (const item of serverArr) {
    const id = typeof item.id === "string" ? item.id : "";
    if (!id || deletedIds.has(id)) continue;
    merged.set(id, item);
  }

  for (const item of incomingArr) {
    const id = typeof item.id === "string" ? item.id : "";
    if (!id || deletedIds.has(id)) continue;
    if (!merged.has(id) || preferIncomingOnMatch) {
      merged.set(id, item);
    }
  }

  return Array.from(merged.values());
}

function mergeByKey(
  serverVal: unknown,
  incomingVal: unknown,
  keyFn: (item: Record<string, unknown>) => string,
  preferIncomingOnMatch: boolean
): Array<Record<string, unknown>> {
  const serverArr = asRecordArray(serverVal);
  const incomingArr = asRecordArray(incomingVal);
  const merged = new Map<string, Record<string, unknown>>();

  for (const item of serverArr) {
    const k = keyFn(item);
    if (!k) continue;
    merged.set(k, item);
  }

  for (const item of incomingArr) {
    const k = keyFn(item);
    if (!k) continue;
    if (!merged.has(k) || preferIncomingOnMatch) {
      merged.set(k, item);
    }
  }

  return Array.from(merged.values());
}

function mergeDatabasePayloads(
  serverData: Record<string, unknown>,
  incomingData: Record<string, unknown>,
  preferIncomingOnMatch: boolean
): Record<string, unknown> {
  const deletedSet = new Set<string>();
  const addDeleted = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const entry of arr) {
      if (typeof entry === "string" && entry) {
        deletedSet.add(entry);
      }
    }
  };
  addDeleted(serverData.deletedIds);
  addDeleted(incomingData.deletedIds);
  const deletedIds = Array.from(deletedSet).slice(-500);
  const deletedFinalSet = new Set(deletedIds);

  const base = preferIncomingOnMatch
    ? { ...serverData, ...incomingData }
    : { ...incomingData, ...serverData };

  return {
    ...base,
    students: mergeByKey(
      serverData.students,
      incomingData.students,
      (s) => (typeof s.id === "string" ? s.id.trim() : ""),
      preferIncomingOnMatch
    ),
    teachers: mergeByKey(
      serverData.teachers,
      incomingData.teachers,
      (t) => (typeof t.name === "string" ? t.name.trim().toLowerCase() : ""),
      preferIncomingOnMatch
    ),
    officers: mergeByKey(
      serverData.officers,
      incomingData.officers,
      (o) => (typeof o.name === "string" ? o.name.trim().toLowerCase() : ""),
      preferIncomingOnMatch
    ),
    announcements: mergeById(
      serverData.announcements,
      incomingData.announcements,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    fundRecords: mergeById(
      serverData.fundRecords,
      incomingData.fundRecords,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    grades: mergeById(
      serverData.grades,
      incomingData.grades,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    evaluations: mergeById(
      serverData.evaluations,
      incomingData.evaluations,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    violations: mergeById(
      serverData.violations,
      incomingData.violations,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    requests: mergeById(
      serverData.requests,
      incomingData.requests,
      deletedFinalSet,
      preferIncomingOnMatch
    ),
    deletedIds,
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/class-data", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const snapshot = await readSnapshotFromDisk();
    if (!snapshot) {
      res.json({
        exists: false,
        updatedAt: 0,
        data: null,
      });
      return;
    }
    res.json({
      exists: true,
      updatedAt: snapshot.updatedAt,
      lastSender: snapshot.lastSender ?? "",
      data: snapshot.data,
    });
  });

  app.post("/api/class-data", async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const candidateData =
      body && typeof body === "object" && body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : body;

    if (!candidateData || typeof candidateData !== "object" || !Array.isArray(candidateData.students)) {
      res.status(400).json({ error: "Dữ liệu JSON không hợp lệ." });
      return;
    }

    const updatedAt =
      body && typeof body.updatedAt === "number" && Number.isFinite(body.updatedAt)
        ? body.updatedAt
        : Date.now();

    const snapshot: ServerSnapshot = {
      updatedAt,
      lastSender:
        body && typeof body.sender === "string" ? body.sender : undefined,
      data: candidateData,
    };

    await writeSnapshotToDisk(snapshot);
    res.json({
      ok: true,
      updatedAt: snapshot.updatedAt,
      lastSender: snapshot.lastSender ?? "",
    });
  });

  app.post("/api/class-data/merge", async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const candidateData =
      body && typeof body === "object" && body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : body;

    if (!candidateData || typeof candidateData !== "object" || !Array.isArray(candidateData.students)) {
      res.status(400).json({ error: "Dữ liệu JSON không hợp lệ." });
      return;
    }

    const existing = await readSnapshotFromDisk();
    const now = Date.now();
    const baseUpdatedAt =
      body && typeof body.baseUpdatedAt === "number" && Number.isFinite(body.baseUpdatedAt)
        ? body.baseUpdatedAt
        : 0;
    const forceReplace = body?.forceReplace === true;
    const sender =
      body && typeof body.sender === "string" ? body.sender : undefined;

    let nextData: Record<string, unknown>;
    if (!existing || forceReplace) {
      nextData = candidateData;
    } else {
      const preferIncomingOnMatch =
        baseUpdatedAt === 0 || baseUpdatedAt >= existing.updatedAt;
      nextData = mergeDatabasePayloads(
        existing.data,
        candidateData,
        preferIncomingOnMatch
      );
    }

    const snapshot: ServerSnapshot = {
      updatedAt: now,
      lastSender: sender ?? existing?.lastSender,
      data: nextData,
    };

    await writeSnapshotToDisk(snapshot);
    res.json({
      ok: true,
      updatedAt: snapshot.updatedAt,
      lastSender: snapshot.lastSender ?? "",
      data: snapshot.data,
    });
  });

  app.get("/api/class-data/export", async (_req, res) => {
    const snapshot = await readSnapshotFromDisk();
    if (!snapshot) {
      res.status(404).json({ error: "Chưa có dữ liệu trên máy chủ để xuất." });
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="CNTT1-9K7-backup.json"');
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Data-Updated-At", String(snapshot.updatedAt));
    res.send(JSON.stringify(snapshot.data, null, 2));
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
