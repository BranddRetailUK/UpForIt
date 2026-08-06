import { describe, expect, it } from "vitest";
import {
  resetPasswordEmailHtml,
  ticketConfirmationEmailHtml,
  verificationEmailHtml
} from "./email-templates";

const siteUrl = "https://www.upforitevents.co.uk";

describe("transactional email templates", () => {
  it("renders a branded, table-based verification email with inline styles", () => {
    const html = verificationEmailHtml({
      displayName: "Scott & Co",
      url: `${siteUrl}/api/auth/verify?token=test-token&next=%2Fevents%23tickets`,
      siteUrl
    });

    expect(html).toContain("UPFORIT");
    expect(html).toContain("You’re on the list");
    expect(html).toContain("Scott &amp; Co");
    expect(html).toContain("role=\"presentation\"");
    expect(html).toContain("#ffdf00");
    expect(html).toContain("#d90062");
    expect(html).toContain("#008ef0");
    expect(html).toContain("WHITE_LOGO_WEB_filqtw");
    expect(html).toContain("SUMMER_ROUND_UP_e2jcsl");
    expect(html).toContain("b_rgb:050505");
    expect(html).toContain("b_rgb:008ef0");
    expect(html).toContain("content=\"light only\"");
    expect(html).toContain("token=test-token&amp;next=%2Fevents%23tickets");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("class=");
  });

  it("renders the reset expiry guidance and testing-recipient banner safely", () => {
    const html = resetPasswordEmailHtml({
      displayName: "A <User>",
      url: `${siteUrl}/account/reset-password?token=reset-token`,
      siteUrl,
      originalRecipient: "person+test@example.com"
    });

    expect(html).toContain("Link expires in one hour");
    expect(html).toContain("TESTING DELIVERY");
    expect(html).toContain("A &lt;User&gt;");
    expect(html).toContain("person+test@example.com");
  });

  it("renders ticket attachment guidance and an account CTA", () => {
    const html = ticketConfirmationEmailHtml({
      displayName: "Ticket Buyer",
      accountUrl: `${siteUrl}/account`,
      siteUrl
    });

    expect(html).toContain("Tickets secured");
    expect(html).toContain("Download the attached PDF");
    expect(html).toContain("View my account");
    expect(html).toContain(`${siteUrl}/account`);
  });
});
