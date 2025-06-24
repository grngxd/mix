export const environment: "prod" | "dev" = (() => {
  const arg1 = process.argv[1] || "";

  if (arg1.includes("bunx")) return "prod";

  if (
    arg1.includes(".bun\\install\\global") || 
    arg1.includes(".bun/install/global")
  ) {
    return "prod";
  }

  return "dev";
})();

export const isProd = environment === "prod";
export const isDev = environment === "dev";