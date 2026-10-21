const nodemailer = require('nodemailer');
const db = require('./db');

/**
 * Default fallback SMTP configuration
 */
const DEFAULT_CONFIG = {
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_secure: '0',
    smtp_user: 'clintondye6@gmail.com',
    smtp_pass: 'ljhqowfjfusseevo',
    smtp_from: 'clintondye6@gmail.com',
    smtp_from_name: 'PND Bank Alerts',
    smtp_enabled: '1'
};

/**
 * Get active SMTP configuration from database with fallback
 */
async function getSmtpConfig(override = {}) {
    try {
        const settings = await db.getSettings();
        return {
            host: override.smtp_host || settings?.smtp_host || DEFAULT_CONFIG.smtp_host,
            port: parseInt(override.smtp_port || settings?.smtp_port || DEFAULT_CONFIG.smtp_port, 10),
            secure: (override.smtp_secure !== undefined ? override.smtp_secure : (settings?.smtp_secure || DEFAULT_CONFIG.smtp_secure)) === '1',
            user: override.smtp_user || settings?.smtp_user || DEFAULT_CONFIG.smtp_user,
            pass: override.smtp_pass || settings?.smtp_pass || DEFAULT_CONFIG.smtp_pass,
            from: override.smtp_from || settings?.smtp_from || DEFAULT_CONFIG.smtp_from,
            fromName: override.smtp_from_name || settings?.smtp_from_name || DEFAULT_CONFIG.smtp_from_name,
            enabled: (override.smtp_enabled !== undefined ? override.smtp_enabled : (settings?.smtp_enabled || DEFAULT_CONFIG.smtp_enabled)) === '1'
        };
    } catch (e) {
        console.warn("[Mailer] Could not read settings from db, using defaults:", e.message);
        return {
            host: override.smtp_host || DEFAULT_CONFIG.smtp_host,
            port: parseInt(override.smtp_port || DEFAULT_CONFIG.smtp_port, 10),
            secure: override.smtp_secure === '1',
            user: override.smtp_user || DEFAULT_CONFIG.smtp_user,
            pass: override.smtp_pass || DEFAULT_CONFIG.smtp_pass,
            from: override.smtp_from || DEFAULT_CONFIG.smtp_from,
            fromName: override.smtp_from_name || DEFAULT_CONFIG.smtp_from_name,
            enabled: true
        };
    }
}

/**
 * Create a nodemailer transporter from configuration
 */
function createTransporter(cfg) {
    const port = parseInt(cfg.port, 10) || 587;
    // Port 465 uses direct SSL (secure: true).
    // Port 587 and 25 use STARTTLS (secure: false, with requireTLS: true).
    // If secure: true is used on port 587, OpenSSL throws "wrong version number" error.
    const isDirectSsl = port === 465 || (Boolean(cfg.secure) && port !== 587 && port !== 25);

    const cleanPass = (cfg.pass || '').trim().replace(/\s/g, '');
    const cleanUser = (cfg.user || '').trim();

    return nodemailer.createTransport({
        host: (cfg.host || 'smtp.gmail.com').trim(),
        port: port,
        secure: isDirectSsl,
        requireTLS: port === 587,
        auth: {
            user: cleanUser,
            pass: cleanPass
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000
    });
}

/**
 * Wrap email content in a responsive, modern banking HTML layout
 */
function renderEmailLayout({ title, headline, badge, contentHtml }) {
    const primaryColor = '#4f46e5';
    const accentColor = '#6366f1';
    const darkBg = '#0a0e1a';
    const cardBg = '#141a29';
    const textLight = '#f8fafc';
    const textMuted = '#94a3b8';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title || 'PND Bank Alert'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #05070d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${textLight};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #05070d; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: ${cardBg}; border-radius: 14px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 24px 30px; background: linear-gradient(135deg, #0b1021 0%, #151b30 100%); border-bottom: 1px solid #1e293b;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">
                                            <span style="color: ${accentColor}; font-weight: 900;">PND</span> BANK
                                        </div>
                                        <div style="font-size: 11px; color: ${textMuted}; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px;">
                                            Secure Core Banking System
                                        </div>
                                    </td>
                                    ${badge ? `
                                    <td align="right">
                                        <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: ${badge.bg || '#3b82f6'}; color: ${badge.color || '#ffffff'};">
                                            ${badge.text}
                                        </span>
                                    </td>` : ''}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Headline Banner -->
                    ${headline ? `
                    <tr>
                        <td style="padding: 24px 30px 0 30px;">
                            <h2 style="margin: 0; font-size: 19px; font-weight: 700; color: #ffffff; line-height: 1.4;">
                                ${headline}
                            </h2>
                        </td>
                    </tr>` : ''}

                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 20px 30px 30px 30px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                            ${contentHtml}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px; background-color: #0a0e1a; border-top: 1px solid #1e293b; font-size: 11px; color: ${textMuted}; text-align: center; line-height: 1.5;">
                            <p style="margin: 0 0 6px 0;">This is an automated security transmission from <strong>PND Bank</strong>.</p>
                            <p style="margin: 0 0 6px 0;">Do not reply directly to this automated email. For account assistance, sign in to your dashboard support channel.</p>
                            <p style="margin: 0; color: #64748b;">© ${new Date().getFullYear()} PND Bank Inc. All rights reserved. Encrypted with 256-bit TLS.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * Send an email using configured SMTP transporter
 */
async function sendMail({ to, subject, html, text }) {
    try {
        const cfg = await getSmtpConfig();
        if (!cfg.enabled) {
            console.log("[Mailer] SMTP notifications are disabled in settings. Skipping email to:", to);
            return { skipped: true, reason: 'disabled' };
        }
        if (!to) {
            console.warn("[Mailer] No recipient provided. Skipping email.");
            return { skipped: true, reason: 'missing_recipient' };
        }

        const transporter = createTransporter(cfg);
        const fromAddress = `"${cfg.fromName}" <${cfg.from}>`;

        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text: text || subject,
            html
        });

        console.log(`[Mailer] Successfully sent "${subject}" to ${to}. MessageId:`, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Mailer] Failed to send email to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Test SMTP connection and send a test email
 */
async function testSmtpConnection(testRecipient = 'clintondye6@gmail.com', customConfig = null) {
    const cfg = await getSmtpConfig(customConfig || {});
    const transporter = createTransporter(cfg);

    // 1. Verify credentials and handshake
    await transporter.verify();

    // 2. Send test verification email
    const fromAddress = `"${cfg.fromName}" <${cfg.from}>`;
    const html = renderEmailLayout({
        title: 'SMTP Connection Test',
        headline: 'SMTP Verification Successful',
        badge: { text: 'Connected', bg: '#10b981', color: '#ffffff' },
        contentHtml: `
            <p>Hello Administrator,</p>
            <p>Your SMTP mail server has been successfully verified and connected to your PND Bank core platform.</p>
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-left: 4px solid #10b981; border-radius: 6px; padding: 14px; margin: 18px 0; font-size: 13px;">
                <div style="margin-bottom: 6px;"><strong>Host:</strong> ${cfg.host}</div>
                <div style="margin-bottom: 6px;"><strong>Port:</strong> ${cfg.port} (${cfg.secure ? 'SSL' : 'TLS/STARTTLS'})</div>
                <div style="margin-bottom: 6px;"><strong>Sender Account:</strong> ${cfg.user}</div>
                <div><strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">Verified & Operational</span></div>
            </div>
            <p>Email alerts are now actively monitoring logins, withdrawals, deposits, transfers, and administrative notifications.</p>
        `
    });

    const info = await transporter.sendMail({
        from: fromAddress,
        to: testRecipient,
        subject: 'PND Bank - SMTP Connection Verified',
        text: 'Your SMTP mail server has been successfully verified and connected to PND Bank.',
        html
    });

    return {
        success: true,
        messageId: info.messageId,
        recipient: testRecipient,
        host: cfg.host,
        port: cfg.port
    };
}

// ==============================================================================
// EVENT-SPECIFIC NOTIFICATIONS
// ==============================================================================

/**
 * 1. Login Alert Notification
 */
async function sendLoginAlertEmail({ user, ip, userAgent }) {
    if (!user || !user.email) return;

    const timeStr = new Date().toUTCString();
    const html = renderEmailLayout({
        title: 'Security Alert: New Account Login',
        headline: 'New Sign-in Detected',
        badge: { text: 'Security Alert', bg: '#f59e0b', color: '#000000' },
        contentHtml: `
            <p>Dear <strong>${user.name || 'Valued Client'}</strong>,</p>
            <p>We detected a new sign-in to your PND Bank online account.</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                        <td style="color: #94a3b8; width: 120px;">Account Name:</td>
                        <td style="color: #ffffff; font-weight: 600;">${user.name}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Account Number:</td>
                        <td style="color: #ffffff; font-weight: 600;">••••${String(user.account_number || '').slice(-4)}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Timestamp:</td>
                        <td style="color: #ffffff;">${timeStr}</td>
                    </tr>
                    ${ip ? `
                    <tr>
                        <td style="color: #94a3b8;">IP Address:</td>
                        <td style="color: #ffffff; font-family: monospace;">${ip}</td>
                    </tr>` : ''}
                </table>
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                If this was you, you can safely disregard this message. If you did not initiate this login, please contact our security team or sign in to freeze your account immediately.
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `🔐 Security Alert: New Login to your PND Bank Account`,
        html
    });
}

/**
 * 2. Withdrawal Request Submitted Notification
 */
async function sendWithdrawalRequestEmail({ user, withdrawal }) {
    if (!user || !user.email) return;

    const amt = parseFloat(withdrawal.amount || 0).toLocaleString();
    const method = (withdrawal.withdrawal_method || 'bank').toUpperCase();
    const html = renderEmailLayout({
        title: 'Withdrawal Request Submitted',
        headline: 'Withdrawal Pending Review',
        badge: { text: 'Pending Approval', bg: '#f59e0b', color: '#000000' },
        contentHtml: `
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>Your withdrawal request of <strong>$${amt} USD</strong> has been received and logged into our compliance queue.</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                        <td style="color: #94a3b8; width: 140px;">Requested Amount:</td>
                        <td style="color: #10b981; font-weight: 700; font-size: 15px;">$${amt} USD</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Method:</td>
                        <td style="color: #ffffff; font-weight: 600;">${method}</td>
                    </tr>
                    ${withdrawal.bank_name ? `
                    <tr>
                        <td style="color: #94a3b8;">Recipient Bank:</td>
                        <td style="color: #ffffff;">${withdrawal.bank_name}</td>
                    </tr>` : ''}
                    ${withdrawal.account_number ? `
                    <tr>
                        <td style="color: #94a3b8;">Account Number:</td>
                        <td style="color: #ffffff;">••••${String(withdrawal.account_number).slice(-4)}</td>
                    </tr>` : ''}
                    <tr>
                        <td style="color: #94a3b8;">Network Fee Paid:</td>
                        <td style="color: #eab308;">${withdrawal.fee || 5} USDT</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Status:</td>
                        <td style="color: #f59e0b; font-weight: 600;">Pending Review</td>
                    </tr>
                </table>
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                Our compliance and settlement team is verifying the transaction details. You will receive an email once the request has been approved and dispatched.
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `💸 Withdrawal Request Received: $${amt} USD`,
        html
    });
}

/**
 * 3. Withdrawal Status Change Notification (Approved, Rejected, Hold, Returned)
 */
async function sendWithdrawalStatusEmail({ user, withdrawal, action }) {
    if (!user || !user.email) return;

    const amt = parseFloat(withdrawal.amount || 0).toLocaleString();
    let badge = { text: 'Updated', bg: '#64748b', color: '#ffffff' };
    let statusText = 'Updated';

    if (action === 'approve') {
        badge = { text: 'Approved', bg: '#10b981', color: '#ffffff' };
        statusText = 'Approved & Processed';
    } else if (action === 'reject') {
        badge = { text: 'Rejected', bg: '#ef4444', color: '#ffffff' };
        statusText = 'Rejected (Refunded to USD Wallet)';
    } else if (action === 'hold') {
        badge = { text: 'On Hold', bg: '#f97316', color: '#ffffff' };
        statusText = 'Placed On Temporary Hold';
    } else if (action === 'returned') {
        badge = { text: 'Returned', bg: '#6366f1', color: '#ffffff' };
        statusText = 'Returned by Clearing Network';
    }

    const html = renderEmailLayout({
        title: `Withdrawal ${action.toUpperCase()}`,
        headline: `Withdrawal Status Update: ${statusText}`,
        badge,
        contentHtml: `
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>There is an update regarding your withdrawal request of <strong>$${amt} USD</strong>.</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                        <td style="color: #94a3b8; width: 140px;">Amount:</td>
                        <td style="color: #ffffff; font-weight: 700;">$${amt} USD</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">New Status:</td>
                        <td style="color: ${badge.bg}; font-weight: 700;">${statusText}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Reference ID:</td>
                        <td style="color: #ffffff; font-family: monospace;">#WTH-${withdrawal.id}</td>
                    </tr>
                </table>
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                ${action === 'approve' 
                    ? 'The funds have been dispatched to your designated payment destination and will reflect according to banking clearing cycles.' 
                    : action === 'reject' 
                    ? 'The withdrawal has been rejected and the USD funds have been refunded back to your bank balance.' 
                    : 'Please log in to your dashboard to review status and communicate with support if additional verification is needed.'}
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `Withdrawal Update: $${amt} USD ${statusText}`,
        html
    });
}

/**
 * 4. Transfer Sent & Received Notifications
 */
async function sendTransferNotification({ sender, receiver, amount, fee }) {
    const amtStr = parseFloat(amount).toLocaleString();

    // Notify sender
    if (sender && sender.email) {
        const senderHtml = renderEmailLayout({
            title: 'Transfer Confirmation',
            headline: 'Transfer Sent Successfully',
            badge: { text: 'Debited', bg: '#6366f1', color: '#ffffff' },
            contentHtml: `
                <p>Dear <strong>${sender.name}</strong>,</p>
                <p>You have successfully transferred <strong>$${amtStr} USD</strong> to <strong>${receiver?.name || 'Client'}</strong>.</p>
                
                <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                    <table width="100%" cellpadding="4" cellspacing="0">
                        <tr>
                            <td style="color: #94a3b8; width: 140px;">Amount Sent:</td>
                            <td style="color: #ffffff; font-weight: 700;">-$${amtStr} USD</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Recipient:</td>
                            <td style="color: #ffffff; font-weight: 600;">${receiver?.name} (${receiver?.account_number})</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">USDT Fee Paid:</td>
                            <td style="color: #eab308;">${fee} USDT</td>
                        </tr>
                    </table>
                </div>
            `
        });

        sendMail({
            to: sender.email,
            subject: `Transfer Confirmation: Sent $${amtStr} USD to ${receiver?.name}`,
            html: senderHtml
        }).catch(e => console.warn("[Mailer] Transfer sender notification error:", e.message));
    }

    // Notify receiver
    if (receiver && receiver.email) {
        const receiverHtml = renderEmailLayout({
            title: 'Funds Received',
            headline: 'You Received Funds',
            badge: { text: 'Credited', bg: '#10b981', color: '#ffffff' },
            contentHtml: `
                <p>Dear <strong>${receiver.name}</strong>,</p>
                <p>You have received <strong>$${amtStr} USD</strong> in your PND Bank account from <strong>${sender?.name || 'A client'}</strong>.</p>
                
                <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                    <table width="100%" cellpadding="4" cellspacing="0">
                        <tr>
                            <td style="color: #94a3b8; width: 140px;">Amount Credited:</td>
                            <td style="color: #10b981; font-weight: 700; font-size: 15px;">+$${amtStr} USD</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8;">Sender:</td>
                            <td style="color: #ffffff; font-weight: 600;">${sender?.name}</td>
                        </tr>
                    </table>
                </div>

                <p style="color: #94a3b8; font-size: 13px;">
                    The funds have been credited and are immediately available in your bank balance.
                </p>
            `
        });

        sendMail({
            to: receiver.email,
            subject: `💰 Funds Received: +$${amtStr} USD from ${sender?.name}`,
            html: receiverHtml
        }).catch(e => console.warn("[Mailer] Transfer receiver notification error:", e.message));
    }
}

/**
 * 5. Deposit Request & Deposit Approved Notifications
 */
async function sendDepositRequestEmail({ user, deposit, method }) {
    if (!user || !user.email) return;

    const usdCredit = parseFloat(method.usd_credit || 0).toLocaleString();
    const cryptoAmt = method.deposit_amount;
    const coinSymbol = method.coin_symbol || 'Crypto';

    const html = renderEmailLayout({
        title: 'Deposit Proof Submitted',
        headline: 'Deposit Verification in Progress',
        badge: { text: 'Verification Pending', bg: '#f59e0b', color: '#000000' },
        contentHtml: `
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>We have received your payment proof for a deposit of <strong>$${usdCredit} USD</strong> (${cryptoAmt} ${coinSymbol}).</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                        <td style="color: #94a3b8; width: 140px;">Expected Credit:</td>
                        <td style="color: #10b981; font-weight: 700;">$${usdCredit} USD</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Amount Sent:</td>
                        <td style="color: #ffffff;">${cryptoAmt} ${coinSymbol}</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Status:</td>
                        <td style="color: #f59e0b; font-weight: 600;">Pending Admin Review</td>
                    </tr>
                </table>
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                Once our administration verifies blockchain confirmation on the deposit address, your USD balance will be automatically credited.
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `Deposit Receipt Submitted: $${usdCredit} USD (${coinSymbol})`,
        html
    });
}

async function sendDepositApprovedEmail({ user, deposit, creditAmount }) {
    if (!user || !user.email) return;

    const amtStr = parseFloat(creditAmount || deposit.usd_credit || 0).toLocaleString();
    const html = renderEmailLayout({
        title: 'Deposit Approved',
        headline: 'Deposit Credited Successfully',
        badge: { text: 'Credited', bg: '#10b981', color: '#ffffff' },
        contentHtml: `
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>Great news! Your deposit of <strong>$${amtStr} USD</strong> has been approved and credited to your account balance.</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
                <table width="100%" cellpadding="4" cellspacing="0">
                    <tr>
                        <td style="color: #94a3b8; width: 140px;">Amount Credited:</td>
                        <td style="color: #10b981; font-weight: 700; font-size: 15px;">+$${amtStr} USD</td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8;">Status:</td>
                        <td style="color: #10b981; font-weight: 600;">Completed</td>
                    </tr>
                </table>
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                You can now use these funds for internal transfers, withdrawals, or account holdings.
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `✅ Deposit Approved: +$${amtStr} USD Credited to Your Account`,
        html
    });
}

/**
 * 6. Admin Direct Notification / Message
 */
async function sendAdminMessageEmail({ user, title, message }) {
    if (!user || !user.email) return;

    const html = renderEmailLayout({
        title: title || 'New Notification from PND Bank',
        headline: title || 'New Account Notice',
        badge: { text: 'Official Notice', bg: '#6366f1', color: '#ffffff' },
        contentHtml: `
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>An official communication has been sent to your account from PND Bank Administration:</p>
            
            <div style="background-color: #0b1120; border: 1px solid #1e293b; border-left: 4px solid #6366f1; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 14px; color: #f1f5f9; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
            </div>

            <p style="color: #94a3b8; font-size: 13px;">
                You can view this notice and reply directly to administration by signing into your PND Bank dashboard under the Notifications & Messages drawer.
            </p>
        `
    });

    return await sendMail({
        to: user.email,
        subject: `📩 ${title || 'New Message from PND Bank'}`,
        html
    });
}

module.exports = {
    getSmtpConfig,
    testSmtpConnection,
    sendMail,
    sendLoginAlertEmail,
    sendWithdrawalRequestEmail,
    sendWithdrawalStatusEmail,
    sendTransferNotification,
    sendDepositRequestEmail,
    sendDepositApprovedEmail,
    sendAdminMessageEmail
};
