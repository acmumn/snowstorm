import { EventEmitter } from "node:events";
import { db } from "./db";
import session, { SessionData, Store } from "express-session";

type SessionT = session.Session & Partial<session.SessionData>;

interface DatabaseSession {
  sid: string;
  sess: string;
  user_id: number;
}

export class SessionStore extends Store {
  constructor() {
    super();
  }

  normalize(session: DatabaseSession): SessionData {
    const { sid, sess, user_id, ...user } = session;
    return { ...JSON.parse(sess), user };
  }

  all(callback: (e: Error | null, sessions: SessionData[] | null) => void) {
    try {
      const sessions = db
        .prepare(
          "select sid, sess, users.* from sessions inner join users on sessions.user_id = users.id",
        )
        .all() as DatabaseSession[];
      callback(null, sessions.map(this.normalize));
    } catch (e) {
        // @ts-expect-error
      callback(e, null);
    }
  }

  set(sid: string, session: SessionData, callback: (e: Error | null) => void) {
    if (!session.user) {
      callback(null);
      return;
    }
    try {
      const user_id = session.user?.id;
      // @ts-ignore
      delete session.user;
      const sess = JSON.stringify(session);
      db.prepare(
        "insert into sessions (sid, sess, user_id) values (?, ?, ?)",
      ).run(sid, sess, user_id);
      callback(null);
    } catch (e) {
        // @ts-expect-error
      callback(e);
    }
  }

  get(
    sid: string,
    callback: (e: Error | null, session: SessionData | null) => void,
  ) {
    try {
      const session = db
        .prepare(
          "select sid, sess, users.* from sessions inner join users on sessions.user_id = users.id where sid = ?",
        )
        .get(sid) as DatabaseSession;
      callback(null, session ? this.normalize(session) : null);
    } catch (e) {
        // @ts-expect-error
      callback(e, null);
    }
  }

  destroy(sid: string, callback: (e: Error | null) => void) {
    try {
      db.prepare("delete from sessions where sid = ?").run(sid);
      callback(null);
    } catch (e) {
        // @ts-expect-error
      callback(e);
    }
  }

  length(callback: (e: Error | null) => void) {
    try {
      const count = db.prepare("select count(*) from sessions").pluck().get();
      callback(null);
    } catch (e) {
        // @ts-expect-error
      callback(e);
    }
  }

  clear(callback: (e: Error | null) => void) {
    try {
      db.prepare("delete from sessions").run();
      callback(null);
    } catch (e) {
        // @ts-expect-error
      callback(e);
    }
  }

  touch(sid: string, session: SessionData, callback: () => void) {
    db.prepare("update sessions set sess = ? where sid = ?").run(
      JSON.stringify(session),
      sid,
    );
    callback();
  }
}
