import path, { join } from "node:path";
import { fileURLToPath } from "node:url";


    // @ts-expect-error
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const demand = <T>(name: string, value: T | undefined): T => {
  if (value === undefined) {
    throw new Error(`${name} is undefined`);
  } else {
    return value;
  }
};

const fromDir = (dir: string) => join(__dirname, dir);

export const VIEWS_DIR = fromDir("../views");
export const STATIC_DIR = fromDir("../static");
export const DB_FILE = fromDir("../snowstorm.db");

export const PORT = demand("PORT", process.env.PORT);
export const HOST = demand("HOST", process.env.HOST);
export const DISCORD_CLIENT_ID = demand(
  "DISCORD_CLIENT_ID",
  process.env.DISCORD_CLIENT_ID,
);
export const DISCORD_CLIENT_SECRET = demand(
  "DISCORD_CLIENT_SECRET",
  process.env.DISCORD_CLIENT_SECRET,
);
export const DISCORD_OAUTH_URL = demand(
  "DISCORD_OAUTH_URL",
  process.env.DISCORD_OAUTH_URL,
);
export const COOKIE_SECRET = demand(
    "COOKIE_SECRET",
    process.env.COOKIE_SECRET,
);

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PROD = NODE_ENV === "production";
