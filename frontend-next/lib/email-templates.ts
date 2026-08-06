type EmailCallToAction = {
  label: string;
  url: string;
};

type EmailShellOptions = {
  preheader: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  noticeTitle: string;
  noticeText: string;
  siteUrl: string;
  originalRecipient?: string;
};

type AuthEmailOptions = {
  displayName: string;
  url: string;
  siteUrl: string;
  originalRecipient?: string;
};

type TicketEmailOptions = {
  displayName: string;
  accountUrl: string;
  siteUrl: string;
  originalRecipient?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] || character);
}

function safeEmailUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Email link must use HTTP or HTTPS");
  return escapeHtml(url.toString());
}

function callToAction({ label, url }: EmailCallToAction) {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:26px 0 22px">
    <tr>
      <td bgcolor="#ffdf00" style="border:3px solid #050505">
        <a href="${safeEmailUrl(url)}" style="display:inline-block;padding:14px 22px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;line-height:20px;text-decoration:none;text-transform:uppercase">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function directLink(url: string) {
  const href = safeEmailUrl(url);
  return `<p style="margin:0;color:#4a4a4a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px">Button not working? Copy and paste this secure link:<br><a href="${href}" style="color:#0065d9;text-decoration:underline;word-break:break-all">${href}</a></p>`;
}

function emailShell({
  preheader,
  eyebrow,
  title,
  bodyHtml,
  noticeTitle,
  noticeText,
  siteUrl,
  originalRecipient
}: EmailShellOptions) {
  const homeUrl = safeEmailUrl(siteUrl);
  const testingBanner = originalRecipient
    ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">
        <tr><td bgcolor="#ffe4f0" style="border:2px solid #d90062;padding:10px 12px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px">TESTING DELIVERY &mdash; originally addressed to ${escapeHtml(originalRecipient)}</td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#29c6f5;color:#050505">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#29c6f5" style="width:100%;border-collapse:collapse;background:#29c6f5">
      <tr>
        <td align="center" style="padding:28px 12px">
          <table role="presentation" width="640" border="0" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse">
            <tr>
              <td bgcolor="#050505" style="border:4px solid #050505;padding:22px 26px">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="color:#ffffff;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:30px;font-weight:900;letter-spacing:-1px;line-height:34px">UPFORIT</td>
                    <td align="right" style="color:#ffdf00;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:900;letter-spacing:1px;line-height:16px;text-transform:uppercase">Events &bull; Music<br><span style="color:#ffffff">Good energy</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
                  <tr><td width="48%" height="8" bgcolor="#ffdf00" style="height:8px;font-size:0;line-height:0">&nbsp;</td><td width="28%" height="8" bgcolor="#d90062" style="height:8px;font-size:0;line-height:0">&nbsp;</td><td width="24%" height="8" bgcolor="#0065d9" style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr>
                </table>
              </td>
            </tr>
            <tr><td height="18" style="height:18px;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td bgcolor="#d90062" style="padding:0 8px 8px 0">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;background:#ffffff">
                  <tr>
                    <td style="border:4px solid #050505;padding:34px 30px">
                      ${testingBanner}
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
                        <tr><td bgcolor="#ffdf00" style="border:2px solid #050505;padding:6px 10px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:900;letter-spacing:.7px;line-height:14px;text-transform:uppercase">${escapeHtml(eyebrow)}</td></tr>
                      </table>
                      <h1 style="margin:0 0 24px;color:#050505;font-family:Arial Black,Arial,Helvetica,sans-serif;font-size:34px;font-weight:900;letter-spacing:-1px;line-height:38px;text-transform:uppercase">${escapeHtml(title)}</h1>
                      ${bodyHtml}
                      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#dfeef8" style="width:100%;border-collapse:collapse;margin:28px 0 0;background:#dfeef8">
                        <tr>
                          <td width="8" bgcolor="#0065d9" style="width:8px;font-size:0;line-height:0">&nbsp;</td>
                          <td style="padding:14px 16px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px"><strong style="text-transform:uppercase">${escapeHtml(noticeTitle)}</strong><br>${escapeHtml(noticeText)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td height="18" style="height:18px;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td bgcolor="#050505" style="border:4px solid #050505;padding:20px 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px">
                <strong style="color:#ffdf00;font-size:14px;text-transform:uppercase">Good vibes only.</strong><br>Respect the ravers. No bad energy.<br>
                <a href="${homeUrl}" style="color:#ffffff;text-decoration:underline">upforitevents.co.uk</a>
              </td>
            </tr>
            <tr><td style="padding:14px 20px 0;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;text-align:center">This is a transactional email from UPFORIT Events.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmailHtml({ displayName, url, siteUrl, originalRecipient }: AuthEmailOptions) {
  return emailShell({
    preheader: "One quick tap and your UPFORIT account is ready.",
    eyebrow: "You’re on the list",
    title: "Verify your account",
    siteUrl,
    originalRecipient,
    noticeTitle: "Secure one-time link",
    noticeText: "This verification link expires after 24 hours. If you didn’t create an UPFORIT account, you can safely ignore this email.",
    bodyHtml: `<p style="margin:0 0 14px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">Your UPFORIT account is nearly ready. Verify your email to activate it, sign in and get back to the tickets.</p>
      ${callToAction({ label: "Verify email", url })}
      ${directLink(url)}`
  });
}

export function resetPasswordEmailHtml({ displayName, url, siteUrl, originalRecipient }: AuthEmailOptions) {
  return emailShell({
    preheader: "Choose a new password for your UPFORIT account.",
    eyebrow: "Password reset",
    title: "Choose a new password",
    siteUrl,
    originalRecipient,
    noticeTitle: "Link expires in one hour",
    noticeText: "For your security, this link can only be used once. If you didn’t request a password reset, leave your account unchanged and ignore this email.",
    bodyHtml: `<p style="margin:0 0 14px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">We received a request to reset your UPFORIT password. Use the secure button below to choose a new one.</p>
      ${callToAction({ label: "Choose new password", url })}
      ${directLink(url)}`
  });
}

export function ticketConfirmationEmailHtml({ displayName, accountUrl, siteUrl, originalRecipient }: TicketEmailOptions) {
  return emailShell({
    preheader: "Your UPFORIT tickets are attached and ready for the event.",
    eyebrow: "Tickets secured",
    title: "Your tickets are here",
    siteUrl,
    originalRecipient,
    noticeTitle: "Ready at the door",
    noticeText: "Each ticket has its own unique QR code and admits one person. A QR code can only be checked in once, so keep your PDF private.",
    bodyHtml: `<p style="margin:0 0 14px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0 0 22px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">You’re in! Your printable UPFORIT tickets are attached as one PDF, with one ticket and one unique QR code per page.</p>
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        <tr><td width="36" valign="top" style="padding:0 0 12px;color:#d90062;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">01</td><td valign="top" style="padding:1px 0 12px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>Download the attached PDF</strong> and save it to your phone.</td></tr>
        <tr><td width="36" valign="top" style="padding:0 0 12px;color:#d90062;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">02</td><td valign="top" style="padding:1px 0 12px;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>Bring every ticket you purchased</strong> for your group.</td></tr>
        <tr><td width="36" valign="top" style="padding:0;color:#d90062;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">03</td><td valign="top" style="padding:1px 0 0;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>Show each QR code at entry</strong> for quick check-in.</td></tr>
      </table>
      ${callToAction({ label: "View my account", url: accountUrl })}`
  });
}
