import { isDatabaseAvailable, query, queryOne } from "../database";
import { loadData, saveData, invalidateCache, AppData } from "../data";

export type DbEngine = "json" | "postgres";

export function getDbEngine(): DbEngine {
  return isDatabaseAvailable() ? "postgres" : "json";
}

export interface Repository<T> {
  findAll(filters?: Record<string, unknown>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export abstract class JsonRepository<T extends { id: string }> implements Repository<T> {
  protected abstract getCollection(data: AppData): T[];

  async findAll(): Promise<T[]> {
    const data = await loadData();
    return this.getCollection(data);
  }

  async findById(id: string): Promise<T | null> {
    const data = await loadData();
    return this.getCollection(data).find(item => item.id === id) || null;
  }

  async create(item: T): Promise<T> {
    const data = await loadData();
    this.getCollection(data).push(item);
    await saveData(data);
    return item;
  }

  async update(id: string, item: Partial<T>): Promise<T | null> {
    const data = await loadData();
    const items = this.getCollection(data);
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...item } as T;
    await saveData(data);
    return items[index];
  }

  async delete(id: string): Promise<boolean> {
    const data = await loadData();
    const items = this.getCollection(data);
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    await saveData(data);
    return true;
  }
}

export function repository<T extends { id: string }>(jsonRepo: JsonRepository<T>, pgRepo?: Repository<T>): Repository<T> {
  return getDbEngine() === "postgres" && pgRepo ? pgRepo : jsonRepo;
}
