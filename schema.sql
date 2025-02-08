drop table if exists users;
create table users (
    id integer primary key,
    discord_id text not null,

    username text not null,
    display_name text not null,
    avatar text not null,

    refresh_token text not null,

    admin integer not null default 0,

    created_at integer not null default (unixepoch())
);

drop table if exists sessions;
create table sessions (
    id integer primary key,

    sid text not null,
    sess text not null,
    user_id integer not null,

    created_at integer not null default (unixepoch()),

    foreign key(user_id) references users(id) on delete cascade
);

drop table if exists problems;
create table problems (
    id integer primary key,
    title text not null,
    description text not null
);

drop table if exists submissions;
create table submissions (
    id integer primary key,
    user_id integer not null,
    problem_id integer not null,
    code text not null,
    created_at integer not null default (unixepoch()),

    foreign key(user_id) references users(id) on delete cascade,
    foreign key(problem_id) references problems(id) on delete cascade
);

