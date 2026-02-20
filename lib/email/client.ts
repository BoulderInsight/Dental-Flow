import { Resend } from "resend";
import { APP_NAME } from "@/lib/config/branding";

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    console.log(
      `[Email skipped - no RESEND_API_KEY] To: ${options.to}, Subject: ${options.subject}`
    );
    return { success: true };
  }
  try {
    await resend.emails.send({
      from:
        options.from ||
        `${APP_NAME} <noreply@${process.env.EMAIL_DOMAIN || "example.com"}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { success: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
