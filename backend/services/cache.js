class SimpleCache {
  constructor(defaultTtlMs = 60000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    if (!this.store.has(key)) {
      return null;
    }

    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    const ttl = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  has(key) {
    return this.get(key) !== null;
  }

  size() {
    return this.store.size;
  }
}

const createCache = (defaultTtlMs) => new SimpleCache(defaultTtlMs);

const studentsCache = createCache(60 * 1000); // 1 minute default TTL

module.exports = {
  SimpleCache,
  createCache,
  studentsCache
};

