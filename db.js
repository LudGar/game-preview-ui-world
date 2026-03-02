const DB_NAME = "AugmentUIPrototype";
const DB_VERSION = 1;

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openDB() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = () => {
    const db = req.result;

    if (!db.objectStoreNames.contains("saves")) {
      const saves = db.createObjectStore("saves", { keyPath: "id" });
      saves.createIndex("by_createdAt", "createdAt");
      saves.createIndex("by_name", "name");
    }

    if (!db.objectStoreNames.contains("uiState")) {
      // keyed by saveId
      db.createObjectStore("uiState", { keyPath: "saveId" });
    }
  };

  const db = await reqToPromise(req);
  return db;
}

export async function getAllSaves(db) {
  const tx = db.transaction(["saves"], "readonly");
  const store = tx.objectStore("saves");
  const saves = await reqToPromise(store.getAll());
  await txDone(tx);
  // newest first
  saves.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return saves;
}

export async function createSave(db, name = "New Character") {
  const id = crypto.randomUUID();
  const now = Date.now();

  const save = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    // placeholder payload; you’ll expand later
    payload: {
      character: { kind: "sphere" },
      inventory: [],
      equipped: {},
      cosmetics: {},
    },
  };

  const defaultUiState = {
    saveId: id,
    lastTab: "map",
    uiOpen: false,
    // rig settings for accessibility later:
    rig: {
      distance: 1.15,
      scale: 1.0,
      yOffset: -0.05,
    },
  };

  const tx = db.transaction(["saves", "uiState"], "readwrite");
  tx.objectStore("saves").put(save);
  tx.objectStore("uiState").put(defaultUiState);
  await txDone(tx);

  return save;
}

export async function getSave(db, id) {
  const tx = db.transaction(["saves"], "readonly");
  const save = await reqToPromise(tx.objectStore("saves").get(id));
  await txDone(tx);
  return save ?? null;
}

export async function updateSave(db, save) {
  const tx = db.transaction(["saves"], "readwrite");
  save.updatedAt = Date.now();
  tx.objectStore("saves").put(save);
  await txDone(tx);
}

export async function getUiState(db, saveId) {
  const tx = db.transaction(["uiState"], "readonly");
  const ui = await reqToPromise(tx.objectStore("uiState").get(saveId));
  await txDone(tx);
  return ui ?? null;
}

export async function setUiState(db, saveId, patch) {
  const tx = db.transaction(["uiState"], "readwrite");
  const store = tx.objectStore("uiState");
  const current = (await reqToPromise(store.get(saveId))) ?? { saveId };
  const next = {
    ...current,
    ...patch,
    rig: { ...(current.rig ?? {}), ...(patch.rig ?? {}) },
  };
  store.put(next);
  await txDone(tx);
  return next;
}