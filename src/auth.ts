import {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  PORT,
  HOST,
} from "./constants";

const getOauthData = (code: string) =>
  fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID!, // safety: if not defined, `constants.ts` throws an error
      client_secret: DISCORD_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${HOST}/auth`,
    }).toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  avatar: string;
}

const getAvatar = (user: DiscordUser) =>
  `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

export const getUser = async (oauthCode: string) => {
  const tokenResponseData = await getOauthData(oauthCode);
  const oauthData = await tokenResponseData.json();
  const userResult = await fetch("https://discord.com/api/users/@me", {
    headers: {
      authorization: `${oauthData.token_type} ${oauthData.access_token}`,
    },
  });
  const body = await userResult.json();
  const { id } = body;
  if (!id) {
    throw new Error("No ID found on user.");
  }

  const user = body as DiscordUser;
  const avatar = getAvatar(user);

  return {
    user,
    avatar,
    oauth: {
      refreshToken: oauthData.refresh_token as string,
      accessToken: oauthData.access_token as string,
    },
  };
};

export const authenticated = (
  req: Express.Request,
  res: Express.Response,
  next: () => void,
) => {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
};
