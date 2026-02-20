import { APP_NAME, APP_URL } from "@/lib/config/branding";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
<tr><td style="background-color:#0f172a;padding:24px 32px;">
<span style="color:#ffffff;font-size:20px;font-weight:700;">${APP_NAME}</span>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
${APP_NAME} &mdash; Your Personal CFO<br>
<a href="${APP_URL}/settings/notifications" style="color:#94a3b8;">Manage notification preferences</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:#2563eb;border-radius:6px;padding:12px 24px;">
<a href="${href}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${text}</a>
</td></tr>
</table>`;
}

export function inviteEmail(opts: {
  inviterName: string;
  practiceName: string;
  role: string;
  acceptUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been invited to ${opts.practiceName} on ${APP_NAME}`,
    html: baseLayout(`
<h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">You're Invited</h2>
<p style="margin:0 0 8px;font-size:15px;color:#334155;">
<strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.practiceName}</strong> on ${APP_NAME}.
</p>
<p style="margin:0 0 24px;font-size:15px;color:#334155;">
Your role: <strong>${opts.role.charAt(0).toUpperCase() + opts.role.slice(1)}</strong>
</p>
${button("Accept Invitation", opts.acceptUrl)}
<p style="margin:0;font-size:13px;color:#94a3b8;">If you didn't expect this invitation, you can safely ignore this email.</p>
`),
  };
}

export function taxAlertEmail(opts: {
  alertTitle: string;
  description: string;
  potentialSavings?: number;
  actionItems: string[];
}): { subject: string; html: string } {
  const savingsHtml = opts.potentialSavings
    ? `<p style="margin:0 0 16px;font-size:15px;color:#059669;font-weight:600;">Potential savings: $${Math.round(opts.potentialSavings).toLocaleString()}</p>`
    : "";
  const actionsHtml = opts.actionItems
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:14px;color:#334155;">${item}</li>`
    )
    .join("");

  return {
    subject: `${APP_NAME} Tax Alert: ${opts.alertTitle}`,
    html: baseLayout(`
<h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">Tax Alert</h2>
<h3 style="margin:0 0 12px;font-size:16px;color:#dc2626;">${opts.alertTitle}</h3>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">${opts.description}</p>
${savingsHtml}
<h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Recommended Actions:</h4>
<ul style="margin:0 0 24px;padding-left:20px;">${actionsHtml}</ul>
${button("View Details", `${APP_URL}/finance/tax-strategy`)}
`),
  };
}

export function monthlyDigestEmail(opts: {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  overheadRatio: number;
  freeCashFlow: number;
  revenueChange: number;
  taxAlertCount: number;
  opportunityCount: number;
}): { subject: string; html: string } {
  const changeArrow = opts.revenueChange >= 0 ? "&#9650;" : "&#9660;";
  const changeColor = opts.revenueChange >= 0 ? "#059669" : "#dc2626";
  const changePct = Math.abs(opts.revenueChange).toFixed(1);

  return {
    subject: `Your ${opts.month} Financial Summary`,
    html: baseLayout(`
<h2 style="margin:0 0 24px;font-size:20px;color:#0f172a;">Monthly Financial Digest</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
<tr>
<td style="padding:16px;background-color:#f8fafc;border-radius:6px;text-align:center;width:33%;">
<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Revenue</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">$${Math.round(opts.revenue).toLocaleString()}</p>
<p style="margin:4px 0 0;font-size:12px;color:${changeColor};">${changeArrow} ${changePct}%</p>
</td>
<td style="width:8px;"></td>
<td style="padding:16px;background-color:#f8fafc;border-radius:6px;text-align:center;width:33%;">
<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Net Profit</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#059669;">$${Math.round(opts.netProfit).toLocaleString()}</p>
</td>
<td style="width:8px;"></td>
<td style="padding:16px;background-color:#f8fafc;border-radius:6px;text-align:center;width:33%;">
<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Overhead</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">${Math.round(opts.overheadRatio * 100)}%</p>
</td>
</tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
<tr>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
<span style="font-size:14px;color:#64748b;">Expenses</span>
</td>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
<span style="font-size:14px;font-weight:600;color:#0f172a;">$${Math.round(opts.expenses).toLocaleString()}</span>
</td>
</tr>
<tr>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
<span style="font-size:14px;color:#64748b;">Free Cash Flow</span>
</td>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
<span style="font-size:14px;font-weight:600;color:#2563eb;">$${Math.round(opts.freeCashFlow).toLocaleString()}</span>
</td>
</tr>
<tr>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
<span style="font-size:14px;color:#64748b;">Active Tax Alerts</span>
</td>
<td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;">
<span style="font-size:14px;font-weight:600;color:#dc2626;">${opts.taxAlertCount}</span>
</td>
</tr>
<tr>
<td style="padding:12px 16px;">
<span style="font-size:14px;color:#64748b;">Savings Opportunities</span>
</td>
<td style="padding:12px 16px;text-align:right;">
<span style="font-size:14px;font-weight:600;color:#059669;">${opts.opportunityCount}</span>
</td>
</tr>
</table>
${button("View Full Dashboard", APP_URL)}
`),
  };
}

export function referralOpportunityEmail(opts: {
  opportunityType: string;
  title: string;
  description: string;
  estimatedSavings?: number;
}): { subject: string; html: string } {
  const savingsHtml = opts.estimatedSavings
    ? `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#059669;">Estimated savings: $${Math.round(opts.estimatedSavings).toLocaleString()}</p>`
    : "";

  return {
    subject: `New Savings Opportunity Detected`,
    html: baseLayout(`
<h2 style="margin:0 0 16px;font-size:20px;color:#0f172a;">New Opportunity</h2>
<h3 style="margin:0 0 12px;font-size:16px;color:#2563eb;">${opts.title}</h3>
<p style="margin:0 0 16px;font-size:15px;color:#334155;">${opts.description}</p>
${savingsHtml}
${button("View Opportunity", `${APP_URL}/referrals`)}
`),
  };
}

export function weeklyInsightsEmail(opts: {
  weekOf: string;
  transactionsCategorized: number;
  cashPosition: number;
  upcomingDeadlines: string[];
}): { subject: string; html: string } {
  const deadlinesHtml =
    opts.upcomingDeadlines.length > 0
      ? `<h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">Upcoming Deadlines:</h4>
<ul style="margin:0 0 24px;padding-left:20px;">${opts.upcomingDeadlines.map((d) => `<li style="margin:0 0 8px;font-size:14px;color:#334155;">${d}</li>`).join("")}</ul>`
      : "";

  return {
    subject: `Your Week in Review`,
    html: baseLayout(`
<h2 style="margin:0 0 24px;font-size:20px;color:#0f172a;">Week of ${opts.weekOf}</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
<tr>
<td style="padding:16px;background-color:#f8fafc;border-radius:6px;text-align:center;width:50%;">
<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Transactions Categorized</p>
<p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${opts.transactionsCategorized}</p>
</td>
<td style="width:8px;"></td>
<td style="padding:16px;background-color:#f8fafc;border-radius:6px;text-align:center;width:50%;">
<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Cash Position</p>
<p style="margin:0;font-size:24px;font-weight:700;color:#2563eb;">$${Math.round(opts.cashPosition).toLocaleString()}</p>
</td>
</tr>
</table>
${deadlinesHtml}
${button("View Dashboard", APP_URL)}
`),
  };
}
