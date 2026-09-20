import { parseCandidateKey } from "../src/canon";

describe("candidate key", () => {
  it("accepts every canonical entity type including deity", () => {
    for (const type of [
      "person",
      "deity",
      "place",
      "collective",
      "polity",
      "role",
      "object",
      "structure",
      "practice",
      "institution",
      "theme",
    ]) {
      expect(
        parseCandidateKey(`candidate:${type}:refsys:eng-v22:god-of-heaven`),
      ).toBe(`candidate:${type}:refsys:eng-v22:god-of-heaven`);
    }
  });

  it("rejects an unknown entity type", () => {
    try {
      parseCandidateKey("candidate:angel:refsys:eng-v22:gabriel");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toMatchObject({ code: "invalid-candidate" });
    }
  });
});
