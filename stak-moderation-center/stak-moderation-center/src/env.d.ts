/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    VINEXT_KV_CACHE?: KVNamespace;
    ASSETS?: Fetcher;
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
    DISCORD_REDIRECT_URI?: string;
    DISCORD_BOT_TOKEN?: string;
    DISCORD_GUILD_ID?: string;
    SESSION_SECRET?: string;
    STAK_OWNER_ROLE_ID?: string;
    STAK_CO_OWNER_ROLE_ID?: string;
    STAK_MANAGEMENT_ROLE_ID?: string;
    STAK_STAFF_MANAGER_ROLE_ID?: string;
    STAK_MODERATOR_ROLE_ID?: string;
    STAK_TRAIL_MODERATOR_ROLE_ID?: string;
  };
}
