class Dexie {
  constructor(name) {
    this.name = name;
    this.schema = {};
  }

  version() {
    return {
      stores: (schema) => {
        this.schema = schema;
        Object.keys(schema).forEach((tableName) => {
          this[tableName] = new Table(this.name, tableName);
        });
      }
    };
  }

  async transaction(_mode, ...tablesAndCallback) {
    const callback = tablesAndCallback.pop();
    await callback();
  }
}

class Table {
  constructor(dbName, tableName) {
    this.dbName = dbName;
    this.tableName = tableName;
  }

  _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _withStore(mode, fn) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, mode);
      const store = tx.objectStore(this.tableName);
      const output = fn(store);
      tx.oncomplete = () => {
        db.close();
        resolve(output);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async get(key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readonly');
      const req = tx.objectStore(this.tableName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async put(value) {
    await this._withStore('readwrite', (store) => store.put(value));
  }

  async add(value) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readwrite');
      const req = tx.objectStore(this.tableName).add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async delete(key) {
    await this._withStore('readwrite', (store) => store.delete(key));
  }

  async clear() {
    await this._withStore('readwrite', (store) => store.clear());
  }

  async toArray() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.tableName, 'readonly');
      const req = tx.objectStore(this.tableName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async bulkPut(items) {
    await this._withStore('readwrite', (store) => {
      items.forEach((item) => store.put(item));
    });
  }

  orderBy(field) {
    return {
      reverse: () => ({
        toArray: async () => {
          const items = await this.toArray();
          return items
            .slice()
            .sort((a, b) => (b[field] || 0) - (a[field] || 0));
        }
      })
    };
  }
}

export default Dexie;
