// Which deployment this is. Render's Test service sets APP_ENV=test; the
// Production service sets nothing, so a production build WITHOUT APP_ENV is
// production (the safe default). `next dev` on a laptop is "development".
export type AppEnv = "production" | "test" | "development";

export function appEnv(): AppEnv {
  if (process.env.APP_ENV === "test") return "test";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isProductionEnv(): boolean {
  return appEnv() === "production";
}
