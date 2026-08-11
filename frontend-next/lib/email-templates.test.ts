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
    expect(html).toContain("NEW_ROUND_LOGO_amtvr0");
    expect(html).not.toContain("SUMMER_ROUND_UP_e2jcsl");
    expect(html).not.toContain("WHITE_LOGO_WEB_filqtw");
    expect(html).not.toContain("b_rgb:");
    expect(html).toContain("content=\"light only\"");
    expect(html).toContain("content=\"light\"");
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain("-webkit-text-fill-color:#050505!important");
    expect(html).toContain("class=\"ufi-force-light\"");
    expect(html).toContain("class=\"ufi-email-gutter\"");
    expect(html).toContain("token=test-token&amp;next=%2Fevents%23tickets");
    expect(html).toContain("@media only screen and (max-width:600px)");
    expect(html).toContain("class=\"ufi-mobile-centre\"");
    expect(html).toContain("class=\"ufi-cta\"");
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

  it("renders a single ticket QR inline with the attachment guidance", () => {
    const html = ticketConfirmationEmailHtml({
      displayName: "Ticket Buyer",
      accountUrl: `${siteUrl}/account`,
      siteUrl,
      singleTicketQrCid: "upforit-ticket-test@upforitevents.co.uk",
      singleTicketNumber: "UFI-T-010001"
    });

    expect(html).toContain("Tickets secured");
    expect(html).toContain("Download the attached PDF");
    expect(html).toContain("View my account");
    expect(html).toContain(`${siteUrl}/account`);
    expect(html).toContain("Your entry QR code");
    expect(html).toContain("src=\"cid:upforit-ticket-test@upforitevents.co.uk\"");
    expect(html).toContain("UFI-T-010001");
    expect(html).toContain("class=\"ufi-ticket-qr__image\"");
  });

  it("keeps multi-ticket confirmations free of a misleading single QR", () => {
    const html = ticketConfirmationEmailHtml({
      displayName: "Group Buyer",
      accountUrl: `${siteUrl}/account`,
      siteUrl
    });

    expect(html).toContain("Your tickets are here");
    expect(html).toContain("Bring every ticket you purchased");
    expect(html).not.toContain("src=\"cid:");
  });
});
