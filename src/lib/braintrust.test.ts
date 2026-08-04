import { describe, expect, it } from "vitest";
import { serializeBraintrustError } from "./braintrust";

describe("serializeBraintrustError", () => {
  it("redacts URLs and encoded data from exported errors", () => {
    const error = new Error(
      "download https://bucket.s3.amazonaws.com/private.pdf failed data:application/pdf;base64,QUJDRA==",
    );

    expect(serializeBraintrustError(error)).toEqual({
      name: "Error",
      message: "download [REDACTED_URL] failed [REDACTED_DATA]",
    });
  });

  it("drops provider errors that contain request content", () => {
    const error = new Error(
      'invalid request {"messages":[{"content":"private PDF text"}]}',
    );

    expect(serializeBraintrustError(error).message).toBe(
      "Provider request failed; request payload redacted",
    );
  });
});
