import { loadData, saveData, ServerUser } from "../data";
import { JsonRepository, repository, Repository } from "./repository";

class JsonAuthRepository extends JsonRepository<ServerUser> {
  protected getCollection(data: import("../data").AppData): ServerUser[] {
    return data.users;
  }

  async findByEmail(email: string): Promise<ServerUser | null> {
    const data = await loadData();
    return data.users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  async findByPin(pin: string): Promise<ServerUser | null> {
    const data = await loadData();
    return data.users.find(u => u.pin === pin) || null;
  }
}

export const authRepository: Repository<ServerUser> & { findByEmail(email: string): Promise<ServerUser | null>; findByPin(pin: string): Promise<ServerUser | null> } =
  repository(new JsonAuthRepository()) as any;
