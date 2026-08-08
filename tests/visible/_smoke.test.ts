import { expect, test } from "vitest";
import { ping } from "@/lib/_smoke";
test("smoke", () => { expect(ping()).toBe("pong"); });
