import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  libraryOwnerId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let libraryOwnerId: number | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    libraryOwnerId = user.id;
    if (ENV.authProvider === "google" && user.role !== "admin") {
      const owner = await db.getExternalLibraryOwner();
      if (!owner) throw new Error("O administrador ainda não entrou na Biblioteca Shinko externa.");
      libraryOwnerId = owner.id;
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    libraryOwnerId,
  };
}
