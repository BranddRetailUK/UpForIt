
type EmailCallToAction = {
  label: string;
  url: string;
};

type EmailShellOptions = {
  ticketBanner?:boolean;
  bannerCid?:string;
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
  singleTicketQrCid?: string;
  bannerCid?:string;
  singleTicketNumber?: string;
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
  return `<table class="ufi-cta" role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:26px 0 22px"><tr>
    <td class="ufi-cta-cell" bgcolor="#000000" style="border:2px solid #ffffff;background-color:#000000;background-image:linear-gradient(#000000,#000000)">
      <a class="ufi-cta-link" href="${safeEmailUrl(url)}" style="display:inline-block;padding:14px 22px;color:#ffffff;-webkit-text-fill-color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:900;line-height:20px;text-decoration:none;text-transform:uppercase">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

function directLink(url: string) {
  const href = safeEmailUrl(url);
  return `<p style="margin:0;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px">Button not working? Copy and paste this secure link:<br><a href="${href}" style="color:#efff00!important;-webkit-text-fill-color:#efff00!important;text-decoration:underline;word-break:break-all">${href}</a></p>`;
}

function inlineTicketQrCode(contentId: string, ticketNumber?: string) {
  const label = ticketNumber ? `Entry QR code for ticket ${ticketNumber}` : "Entry QR code";
  return `<table class="ufi-ticket-qr" role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#efff00" style="width:100%;border-collapse:collapse;margin:24px 0;background-color:#efff00;background-image:linear-gradient(#efff00,#efff00)">
    <tr>
      <td align="center" style="border:3px solid #050505;padding:20px;color:#050505!important;-webkit-text-fill-color:#050505!important;font-family:Arial,Helvetica,sans-serif;text-align:center">
        <strong style="display:block;margin:0 0 12px;font-size:15px;line-height:20px;text-transform:uppercase">Your entry QR code</strong>
        <img class="ufi-ticket-qr__image" src="cid:${escapeHtml(contentId)}" width="240" height="240" alt="${escapeHtml(label)}" style="display:block;width:240px;max-width:100%;height:auto;margin:0 auto;border:0;background:#ffffff;color:#050505;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px">
        ${ticketNumber ? `<span style="display:block;margin:12px 0 0;font-size:12px;font-weight:700;line-height:18px">${escapeHtml(ticketNumber)}</span>` : ""}
        <span style="display:block;margin:8px 0 0;font-size:12px;line-height:18px">Keep this code private and show it at the entrance.</span>
      </td>
    </tr>
  </table>`;
}

function emailShell({preheader,eyebrow,title,bodyHtml,noticeTitle,noticeText,siteUrl,originalRecipient,ticketBanner,bannerCid}:EmailShellOptions){
  const homeUrl=safeEmailUrl(siteUrl);
  const banner=ticketBanner ? `<img src="${bannerCid?`cid:${escapeHtml(bannerCid)}`:safeEmailUrl(new URL('/brand/ticket-email-banner.png',siteUrl).toString())}" width="640" alt="UPFORIT — Your tickets" style="display:block;width:100%;height:auto;border:0">` : `<a href="${homeUrl}" style="font-family:Arial Black,Arial,sans-serif;font-size:48px;line-height:1;font-weight:900;letter-spacing:-2px;color:#ffffff;text-decoration:none">UPFORIT<span style="color:#efff00">.</span></a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(title)}</title><style>
  @media only screen and (max-width:600px){.ufi-mobile-centre{text-align:center!important;padding:26px 20px!important}.ufi-cta{margin-left:auto!important;margin-right:auto!important}h1{font-size:30px!important;line-height:34px!important}.ufi-ticket-step-number,.ufi-ticket-step-copy{display:block!important;width:100%!important;text-align:center!important}.ufi-ticket-step-number{padding:12px 0 4px!important}}
  @media(prefers-color-scheme:dark){.ufi-cta-cell{background-color:#ffffff!important;background-image:linear-gradient(#ffffff,#ffffff)!important;border-color:#000000!important}.ufi-cta-link{color:#000000!important;-webkit-text-fill-color:#000000!important}}
  [data-ogsc] .ufi-cta-cell{background-color:#ffffff!important;background-image:linear-gradient(#ffffff,#ffffff)!important;border-color:#000000!important}[data-ogsc] .ufi-cta-link{color:#000000!important;-webkit-text-fill-color:#000000!important}
  @media(prefers-color-scheme:dark){.ufi-dark{background:#0a0a0a!important;color:#ffffff!important}.ufi-copy{color:#ffffff!important}.ufi-yellow{background:#efff00!important;color:#050505!important}}
  </style></head><body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:collapse;background:#101010;color:#ffffff">
  <tr><td align="center" style="${ticketBanner?'padding:0':'padding:30px 20px'};border-top:5px solid #efff00;border-bottom:5px solid #efff00;background:#0a0a0a">${banner}</td></tr>
  <tr><td class="ufi-mobile-centre ufi-dark" style="padding:32px;color:#ffffff;background:#101010">
  ${originalRecipient?`<p style="padding:12px;border:2px solid #efff00;color:#ffffff;font-size:13px;font-weight:700">TESTING DELIVERY — NOT VALID FOR ENTRY<br>Originally addressed to ${escapeHtml(originalRecipient)}</p>`:''}
  <p style="margin:0 0 12px;color:#efff00;font-size:13px;line-height:18px;letter-spacing:1px;font-weight:900;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
  <h1 style="margin:0 0 22px;font-family:Arial Black,Arial,sans-serif;font-size:36px;line-height:40px;letter-spacing:-1px;font-weight:900;color:#ffffff;text-transform:uppercase">${escapeHtml(title)}</h1>
  ${bodyHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;border-top:3px solid #efff00"><tr><td style="padding:18px 0 0;color:#ffffff;font-size:14px;line-height:22px;font-weight:700"><strong style="color:#efff00;text-transform:uppercase">${escapeHtml(noticeTitle)}</strong><br>${escapeHtml(noticeText)}</td></tr></table>
  </td></tr><tr><td class="ufi-mobile-centre" style="padding:22px 32px;background:#0a0a0a;border-top:1px solid #efff00;color:#ffffff;font-size:13px;line-height:22px;font-weight:700">UPFORIT EVENTS<br><a href="mailto:info@upforitevents.co.uk" style="color:#efff00">info@upforitevents.co.uk</a><br><a href="${homeUrl}" style="color:#ffffff">upforitevents.co.uk</a><p style="margin:12px 0 0">This is a transactional email from UPFORIT Events.</p></td></tr>
  </table></td></tr></table></body></html>`;
}

export function verificationEmailHtml({ displayName, url, siteUrl, originalRecipient }: AuthEmailOptions) {
  return emailShell({
    preheader: "Verify your email to activate your UPFORIT account.",
    eyebrow: "Account verification",
    title: "Verify your account",
    siteUrl,
    originalRecipient,
    noticeTitle: "Secure one-time link",
    noticeText: "This verification link expires after 24 hours. If you didn’t create an UPFORIT account, you can safely ignore this email.",
    bodyHtml: `<p style="margin:0 0 14px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">Your UPFORIT account is nearly ready. Verify your email to activate it, sign in and get back to the tickets.</p>
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
    bodyHtml: `<p style="margin:0 0 14px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">We received a request to reset your UPFORIT password. Use the secure button below to choose a new one.</p>
      ${callToAction({ label: "Choose new password", url })}
      ${directLink(url)}`
  });
}

export function ticketConfirmationEmailHtml({
  displayName,
  accountUrl,
  siteUrl,
  originalRecipient,
  singleTicketQrCid,
  singleTicketNumber,
  bannerCid
}: TicketEmailOptions) {
  const hasSingleTicketQr = Boolean(singleTicketQrCid);
  return emailShell({
    ticketBanner:true,
    bannerCid,
    preheader: hasSingleTicketQr
      ? "Your UPFORIT ticket and entry QR code are ready."
      : "Your UPFORIT tickets are attached and ready for the event.",
    eyebrow: "Tickets secured",
    title: hasSingleTicketQr ? "Your ticket is here" : "Your tickets are here",
    siteUrl,
    originalRecipient,
    noticeTitle: "Ready at the door",
    noticeText: hasSingleTicketQr
      ? "Your unique QR code admits one person and can only be checked in once, so keep this email and the attached PDF private."
      : "Each ticket has its own unique QR code and admits one person. A QR code can only be checked in once, so keep your PDF private.",
    bodyHtml: `<p style="margin:0 0 14px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:26px">Hi <strong>${escapeHtml(displayName)}</strong>,</p>
      <p style="margin:0 0 22px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px">${hasSingleTicketQr
        ? "Your printable UPFORIT ticket is attached as a PDF, and your entry QR code is included below for quick access on your phone."
        : "Your printable UPFORIT tickets are attached as one PDF, with one ticket and one unique QR code per page."}</p>
      ${singleTicketQrCid ? inlineTicketQrCode(singleTicketQrCid, singleTicketNumber) : ""}
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        <tr><td class="ufi-ticket-step-number" width="36" valign="top" style="padding:0 0 12px;color:#efff00!important;-webkit-text-fill-color:#efff00!important;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">01</td><td class="ufi-ticket-step-copy" valign="top" style="padding:1px 0 12px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>Download the attached PDF</strong> and save it to your phone.</td></tr>
        <tr><td class="ufi-ticket-step-number" width="36" valign="top" style="padding:0 0 12px;color:#efff00!important;-webkit-text-fill-color:#efff00!important;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">02</td><td class="ufi-ticket-step-copy" valign="top" style="padding:1px 0 12px;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>${hasSingleTicketQr ? "Keep your QR code private" : "Bring every ticket you purchased"}</strong>${hasSingleTicketQr ? " until you reach the entrance." : " for your group."}</td></tr>
        <tr><td class="ufi-ticket-step-number" width="36" valign="top" style="padding:0;color:#efff00!important;-webkit-text-fill-color:#efff00!important;font-family:Arial Black,Arial,sans-serif;font-size:20px;font-weight:900">03</td><td class="ufi-ticket-step-copy" valign="top" style="padding:1px 0 0;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px"><strong>${hasSingleTicketQr ? "Show the QR code at entry" : "Show each QR code at entry"}</strong> for quick check-in.</td></tr>
      </table>
      ${callToAction({ label: "View my account", url: accountUrl })}`
  });
}
