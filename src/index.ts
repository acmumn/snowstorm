import "dotenv/config";
import express from "express";
import { authenticated, DiscordUser, getUser } from "./auth";
import { DatabaseUser, db } from "./db";
import { COOKIE_SECRET, DISCORD_OAUTH_URL, IS_PROD, PORT, STATIC_DIR } from "./constants";
import session from "express-session";
import { SessionStore } from "./session-store";
import markdownit from 'markdown-it'
const md = markdownit()

declare module "express-session" {
  interface SessionData {
    user: DatabaseUser;
  }
}

const render = (
  req: Express.Request,
  res: Express.Response,
  path: string,
  params: Record<string, any>,
) => {
  res.render("base", { path, params, error: false, user: req.session.user });
};

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(STATIC_DIR));
app.set("view engine", "ejs");
app.use(
    session({
      secret: COOKIE_SECRET,
      resave: false,
      cookie: {
        secure: IS_PROD,
      },
      store: new SessionStore(),
    }),
  );

app.get("/auth", async (req, res) => {
  const { code } = req.query;
  if (code && typeof code === "string") {
    try {
      const { user, avatar, oauth } = await getUser(code);

      const existingUser = db
        .prepare("select * from users where discord_id = ?")
        .get(user.id) as DatabaseUser;
      let dbUser: DatabaseUser;
      if (existingUser) {
        dbUser = db
          .prepare(
            `
                      update users set
                          username = $username,
                          display_name = $display_name,
                          avatar = $avatar,
                          refresh_token = $refresh_token
                      where discord_id = $discord_id
                      returning *
                  `,
          )
          .get({
            username: user.username,
            display_name: user.global_name || "",
            avatar: avatar,
            refresh_token: oauth.refreshToken,
            discord_id: user.id,
          }) as DatabaseUser;
      } else {
        dbUser = db
          .prepare(
            `
                insert into users (
                    discord_id,
                    username,
                    display_name,
                    avatar,
                    refresh_token,
                    admin
                ) values (
                    $discord_id,
                    $username,
                    $display_name,
                    $avatar,
                    $refresh_token,
                    0
                )
                returning *
            `,
          )
          .get({
            discord_id: user.id,
            username: user.username,
            display_name: user.global_name || user.username,
            avatar: avatar,
            refresh_token: oauth.refreshToken,
          }) as DatabaseUser;
      }
      req.session.user = dbUser;
      res.redirect("/");
    } catch (e) {
        console.error(e);
      if (IS_PROD) {
        render(req, res.status(500), "error", {
          error: {
            message: "An error occurred.",
            status: "Internal server error",
          },
        });
      } else {
        render(req, res.status(500), "error", {
          error: {
            message: e.message,
            status: "Internal server error",
          },
        });
      }
    }
  } else {
    res.sendStatus(403);
  }
});

app.get("/logout", authenticated, (req, res) => {
  render(req, res, "logout", { title: "Logout" });
});

app.post("/logout", (req, res) => {
  // TODO: destroy refresh token?
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/login", (_, res) => {
  res.redirect(DISCORD_OAUTH_URL);
});

app.get("/", (req, res) => {
  const problems = db.prepare(`
        SELECT 
        p.id,
        p.*,
        COUNT(s.id) as submissions
    FROM problems p
    LEFT JOIN submissions s ON p.id = s.problem_id
    GROUP BY p.id;

    `).all();
  render(req, res, "home", { title: "Home", problems });
});

app.get("/problem/new", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login");
        return;
    }
    if(!req.session.user.admin) {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to create a new problem.",
                status: "Forbidden",
            },
        });
        return;
    }
    render(req, res, "make-problem", { title: "New Problem" });
});

app.post("/problem/new", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login");
        return;
    }
    if(!req.session.user.admin) {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to create a new problem.",
                status: "Forbidden",
            },
        });
        return;
    }
    const { title, description } = req.body;
    console.log(req.body);
    db.prepare("insert into problems (title, description) values (?, ?)").run(title, md.render(description));
    res.redirect("/");
});

app.get("/problem/:id", (req, res) => {
    if(!req.session.user) {
        res.redirect("/login");
        return;
    }
    const { id } = req.params;
    const problem = db.prepare("select * from problems where id = ?").get(id);
    const userSubmission = db
        .prepare("select * from submissions where problem_id = ? and user_id = ?")
        .get(id, req.session.user.id);
    render(req, res, "problem", { title: problem.title, problem, userSubmission });
});

app.get("/problem/:id/edit", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login");
        return;
    }
    if(!req.session.user.admin) {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to edit this problem.",
                status: "Forbidden",
            },
        });
        return;
    }
    const { id } = req.params;
    const problem = db.prepare("select * from problems where id = ?").get(id);
    render(req, res, "edit-problem", { title: "Edit Problem", problem });
});

app.post("/problem/:id/edit", (req, res) => {
    if (!req.session.user) {
        res.redirect("/login");
        return;
    }
    if(!req.session.user.admin) {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to edit this problem.",
                status: "Forbidden",
            },
        });
        return;
    }
    const { id } = req.params;
    const { title, description } = req.body;
    db.prepare("update problems set title = ?, description = ? where id = ?").run(title, md.render(description), id);
    res.redirect(`/problem/${id}`);
});

app.get("/submission/:id", (req, res) => {
    const { id } = req.params;
    const submission = db.prepare("select * from submissions where id = ?").get(id);
    if(!submission) {
        render(req, res.status(404), "error", {
            error: {
                message: "Submission not found.",
                status: "Not Found",
            },
        });
        return;
    }
    const problem = db.prepare("select * from problems where id = ?").get(submission.problem_id);
    const user = db.prepare("select * from users where id = ?").get(submission.user_id) as DatabaseUser;
    if(req.session.user?.admin || user.discord_id === req.session.user?.discord_id) {
        render(req, res, "submission", { title: "Submission", submission, problem });
    } else {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to view this submission.",
                status: "Forbidden",
            },
        });
    }
});

app.post("/submission", (req, res) => {
    if(!req.session.user) {
        res.redirect("/login");
        return;
    }
    // create
    const { problem_id, code } = req.body;
    const problem = db.prepare("select * from problems where id = ?").get(problem_id);
    if(!problem) {
        render(req, res.status(404), "error", {
            error: {
                message: "Problem not found.",
                status: "Not Found",
            },
        });
        return;
    }
    db.prepare("insert into submissions (user_id, problem_id, code) values (?, ?, ?)").run(req.session.user.id, problem_id, code);
    res.redirect(`/problem/${problem_id}`);
});

app.get("/problem/:id/submissions", (req, res) => {
    if(!req.session.user) {
        res.redirect("/login");
        return;
    }
    if(!req.session.user.admin) {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to view submissions.",
                status: "Forbidden",
            },
        });
        return;
    }
    const { id } = req.params;
    const problem = db.prepare("select * from problems where id = ?").get(id);
    const submissions = db.prepare("select *, users.username as user from submissions inner join users on users.id = submissions.user_id where problem_id = ?").all(id);
    render(req, res, "submissions", { title: "Submissions", problem, submissions });
});

app.post("/submission/:id", (req, res) => {
    // update
    const { id } = req.params;
    const submission = db.prepare("select * from submissions where id = ?").get(id);
    const user = db.prepare("select * from users where id = ?").get(submission.user_id) as DatabaseUser;
    if(typeof req.body.code !== 'string' || req.body.code.length > 1000) {
        render(req, res.status(400), "error", {
            error: {
                message: "Invalid code.",
                status: "Bad Request",
            },
        });
        return;
    }
    if(user.discord_id === req.session.user?.discord_id) {
        db.prepare("update submissions set code = ? where id = ?").run(req.body.code);
        res.redirect(`/submission/${id}`);
    } else {
        render(req, res.status(403), "error", {
            error: {
                message: "You do not have permission to view this submission.",
                status: "Forbidden",
            },
        });
    }
});

app.get("/problem/:id/submit", (req, res) => {
    if(!req.session.user) {
        res.redirect("/login");
        return;
    }
    const { id } = req.params;
    const problem = db.prepare("select * from problems where id = ?").get(id);
    if(!problem) {
        render(req, res.status(404), "error", {
            error: {
                message: "Problem not found.",
                status: "Not Found",
            },
        });
        return;
    }
    render(req, res, "submit", { title: "Submit", problem });
});

app.post("/problem/:id/submit", (req, res) => {
    if(!req.session.user) {
        res.redirect("/login");
        return;
    }
    const { id } = req.params;
    const problem = db.prepare("select * from problems where id = ?").get(id);
    if(!problem) {
        render(req, res.status(404), "error", {
            error: {
                message: "Problem not found.",
                status: "Not Found",
            },
        });
        return;
    }
    if(typeof req.body.code !== 'string' || req.body.code.length > 1000) {
        render(req, res.status(400), "error", {
            error: {
                message: "Invalid code.",
                status: "Bad Request",
            },
        });
        return;
    }
    db.prepare("insert into submissions (user_id, problem_id, code) values (?, ?, ?)").run(req.session.user.id, id, req.body.code);
    res.redirect(`/problem/${id}`);
});



app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})