import Database from "better-sqlite3";
import { DB_FILE } from "./constants.js";

export const db = new Database(DB_FILE);
db.pragma("foreign_keys = ON");

export interface DatabaseUser {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar: string;
  refresh_token: string;
  admin: number; // bool
  created_at: string;
}

export interface DatabaseProblem {
  id: number;
  title: string;
  description: string;
}

export interface DatabaseSubmission {
  id: number;
  user_id: number;
  problem_id: number;
  code: string;
  created_at: string;
}
