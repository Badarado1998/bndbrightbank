import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { testSmtpConnection } from '@/lib/mailer';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function POST(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const testEmail = body.testEmail || 'clintondye6@gmail.com';

        const customConfig = {
            smtp_host: body.smtp_host,
            smtp_port: body.smtp_port,
            smtp_secure: body.smtp_secure,
            smtp_user: body.smtp_user,
            smtp_pass: body.smtp_pass,
            smtp_from: body.smtp_from,
            smtp_from_name: body.smtp_from_name,
            smtp_enabled: '1'
        };

        const result = await testSmtpConnection(testEmail, customConfig);

        return NextResponse.json({
            success: true,
            message: `SMTP connection established and test email sent successfully to ${testEmail}!`,
            details: result
        }, { status: 200 });

    } catch (error) {
        console.error("[SMTP Test Error]:", error);

        let guidance = "";
        if (error.code === 'EAUTH' || (error.message && error.message.includes('535'))) {
            guidance = "Gmail rejected your credentials (535 BadCredentials). Make sure 2-Step Verification is active on this Google Account and create a 16-character App Password under Google Account > Security > App Passwords.";
        } else if (error.message && error.message.includes('wrong version number')) {
            guidance = "Wrong SSL version: Port 587 uses TLS/STARTTLS (not direct SSL). Direct SSL is only for Port 465. The system has now automatically adjusted this.";
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
            guidance = "Connection timed out. Check your SMTP host and port (e.g. smtp.gmail.com on port 587 or 465).";
        }

        return NextResponse.json({
            success: false,
            error: error.message || "Failed to establish SMTP connection.",
            code: error.code,
            guidance
        }, { status: 400 });
    }
}
