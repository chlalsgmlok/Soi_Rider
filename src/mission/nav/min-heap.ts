/**
 * Binary min-heap of integer items keyed by a number (the A* open set). No decrease-key: push the item again with
 * the better key and let the caller skip stale pops (lazy deletion).
 */
export class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.keys.length = 0;
  }

  push(item: number, key: number): void {
    const { items, keys } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      items[i] = items[p];
      keys[i] = keys[p];
      i = p;
    }
    items[i] = item;
    keys[i] = key;
  }

  /** removes and returns the item with the smallest key; −1 when empty */
  pop(): number {
    const { items, keys } = this;
    const n = items.length;
    if (n === 0) return -1;
    const top = items[0];
    const lastItem = items[n - 1];
    const lastKey = keys[n - 1];
    items.length = n - 1;
    keys.length = n - 1;
    const m = n - 1;
    if (m === 0) return top;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      if (l >= m) break;
      const r = l + 1;
      const c = r < m && keys[r] < keys[l] ? r : l;
      if (keys[c] >= lastKey) break;
      items[i] = items[c];
      keys[i] = keys[c];
      i = c;
    }
    items[i] = lastItem;
    keys[i] = lastKey;
    return top;
  }
}
