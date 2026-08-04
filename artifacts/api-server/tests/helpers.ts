/**
 * Shared test helpers for API end-to-end tests.
 * Tests import `agent` and hit routes through supertest without binding a real port.
 */
import { default as supertest } from "supertest";
import app from "../src/app.js";

export const agent = supertest(app);

/** Assert the response status and return the parsed body. Prints the body on mismatch. */
export function expectStatus(res: supertest.Response, expected: number) {
  if (res.status !== expected) {
    throw new Error(
      `Expected HTTP ${expected} but got ${res.status}.\nBody: ${JSON.stringify(res.body, null, 2)}`,
    );
  }
  return res.body;
}
