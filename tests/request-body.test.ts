import { it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readJson, readText } from "@/lib/security";
it("lit le corps brut sans altérer la signature potentielle", async () => {
  const text = ' { "value": 1 }\n';
  const req = new NextRequest("http://localhost", {
    method: "POST",
    body: text,
  });
  expect(await readText(req)).toBe(text);
});
it("refuse un corps surdimensionné même sans Content-Length", async () => {
  const req = new NextRequest("http://localhost", {
    method: "POST",
    body: "x".repeat(32769),
  });
  await expect(readJson(req)).rejects.toThrow("TOO_LARGE");
});
