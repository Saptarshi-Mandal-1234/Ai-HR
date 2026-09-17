import nodemailer from "nodemailer";

export function createMailer(env = process.env) {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_FROM);
  const transporter = configured
    ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD || "" }
        : undefined
    })
    : null;

  async function sendInvitation({ email, role, invitationUrl, expiresAt }) {
    if (!transporter) return { status: "not_configured" };
    try {
      const result = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject: "Your AI HR workspace invitation",
        text: [
          `You were invited to AI HR with the ${role} role.`,
          "",
          `Accept invitation: ${invitationUrl}`,
          `This invitation expires at ${expiresAt}.`,
          "",
          "Ignore this email if you were not expecting the invitation."
        ].join("\n")
      });
      return { status: "sent", messageId: result.messageId || null };
    } catch (error) {
      return { status: "failed", error: error.code || error.name || "smtp_error" };
    }
  }

  return { configured, sendInvitation };
}
