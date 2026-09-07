export async function saveBookToIDB(key: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("book-club-db", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books");
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("books", "readwrite");
      const store = tx.objectStore("books");
      const putReq = store.put(blob, key);
      putReq.onsuccess = () => {
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
      putReq.onerror = () => reject(putReq.error);
    };
  });
}

export async function getBookFromIDB(key: string): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("book-club-db", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("books", "readonly");
      const store = tx.objectStore("books");
      const getReq = store.get(key);
      getReq.onsuccess = async () => {
        const value = getReq.result as Blob | undefined;
        if (!value) {
          db.close();
          resolve(null);
          return;
        }
        try {
          const ab = await value.arrayBuffer();
          db.close();
          resolve(ab);
        } catch (err) {
          db.close();
          reject(err);
        }
      };
      getReq.onerror = () => {
        db.close();
        reject(getReq.error);
      };
    };
  });
}
