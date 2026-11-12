export const ENV = {
  appId: process.env.VITE_APP_ID || process.env.APP_ID || "educore",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Creador de recursos: modelo de Claude y tope diario de turnos de IA por usuario. */
  creatorModel: process.env.CREATOR_MODEL?.trim() || "claude-opus-5-5",
  creatorDailyLimit: Math.max(1, Number(process.env.CREATOR_DAILY_LIMIT) || 60),
};
