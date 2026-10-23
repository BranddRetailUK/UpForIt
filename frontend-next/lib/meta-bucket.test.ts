import { describe, expect, it } from "vitest";
import { bucketRegistrationEvent } from "./meta-bucket";
import { buildMetaEvent } from "./meta-conversion";

describe("bucket registration measurement", () => {
  const user = { id: "user-1", email: "test@example.invalid" };
  it("requires measurement consent independently of entry agreement", () => {
    expect(bucketRegistrationEvent("entry-1", user)).toBeNull();
    expect(bucketRegistrationEvent("entry-1", user, {consent:false})).toBeNull();
  });
  it("deduplicates by saved entry and never reports registration as revenue", () => {
    const event = bucketRegistrationEvent("entry-1", user, {consent:true})!;
    expect(event.eventId).toBe(bucketRegistrationEvent("entry-1", user, {consent:true})!.eventId);
    expect(event.eventId).not.toBe(bucketRegistrationEvent("entry-2", user, {consent:true})!.eventId);
    const payload=buildMetaEvent(event);
    expect(payload.event_name).toBe("CompleteRegistration");
    expect(payload.custom_data).toMatchObject({content_category:"bucket entry"});
    expect(payload.custom_data).not.toHaveProperty("value");
    expect(JSON.stringify(payload)).not.toContain(user.email);
  });
});
