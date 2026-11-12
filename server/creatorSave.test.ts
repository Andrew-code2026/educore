import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { SAVE_BUSY_CODE, SAVE_CONFLICT_CODE } from "../client/src/creator/autosavePolicy";
import { CreatorSaveRejected } from "./creatorDb";
import { creatorCall } from "./routers";

const rejectWith = (error: unknown) => creatorCall(() => Promise.reject(error));

describe("rechazos del guardado manual del creador", () => {
  it("responde con los códigos que el cliente usa para decidir si reintenta", async () => {
    await expect(rejectWith(new CreatorSaveRejected("conflict", "cambió"))).rejects.toMatchObject({ code: SAVE_CONFLICT_CODE, message: "cambió" });
    await expect(rejectWith(new CreatorSaveRejected("generating", "la IA trabaja"))).rejects.toMatchObject({ code: SAVE_BUSY_CODE });
  });

  it("los demás errores siguen siendo una solicitud inválida", async () => {
    await expect(rejectWith(new Error("otra cosa"))).rejects.toMatchObject({ code: "BAD_REQUEST", message: "otra cosa" });
    const forbidden = new TRPCError({ code: "FORBIDDEN", message: "no" });
    await expect(rejectWith(forbidden)).rejects.toBe(forbidden);
  });
});
