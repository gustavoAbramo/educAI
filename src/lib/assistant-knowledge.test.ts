import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKnowledgeFallbackResponse,
  routeAssistantQuestion,
} from "./assistant-knowledge";

describe("assistant knowledge routing", () => {
  it("does not match short aliases inside unrelated words", () => {
    const route = routeAssistantQuestion("Qual foi uma noticia positiva de hoje?");

    assert.equal(route.domain, "news");
    assert.equal(route.requiresFreshSources, true);
    assert.deepEqual(route.matchedTerms, []);
  });

  it("builds comparison responses for known paired concepts", () => {
    const response = buildKnowledgeFallbackResponse(
      "Qual a diferenca entre frontend e backend?",
      "student",
    );

    assert.match(response, /\*\*(Frontend x Backend|Backend x Frontend)\*\*/);
    assert.match(response, /parte visual/i);
    assert.match(response, /regras de negocio/i);
  });
});
