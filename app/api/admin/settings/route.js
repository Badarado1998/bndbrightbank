import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

// GET: Fetch current global settings
export async function GET(request) {
    try {
        if (!await checkAdmin()) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }
        const settings = await db.getSettings();
        return NextResponse.json({ settings }, { status: 200 });
    } catch (error) {
        console.error("Admin fetch settings error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// POST: Update settings values
export async function POST(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const {
            transfer_fee_ratio_usd,
            transfer_fee_ratio_usdt,
            withdrawal_fee_usdt,
            network_fee_usdt,
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_user,
            smtp_pass,
            smtp_from,
            smtp_from_name,
            smtp_enabled
        } = body;

        const newSettings = {};

        // 1. Fee validation and update (if provided)
        if (transfer_fee_ratio_usd !== undefined) {
            if (isNaN(parseFloat(transfer_fee_ratio_usd)) ||
                isNaN(parseFloat(transfer_fee_ratio_usdt)) ||
                isNaN(parseFloat(withdrawal_fee_usdt)) ||
                isNaN(parseFloat(network_fee_usdt))) {
                return NextResponse.json({ error: "All fee settings must be valid numbers." }, { status: 400 });
            }
            newSettings.transfer_fee_ratio_usd = String(transfer_fee_ratio_usd);
            newSettings.transfer_fee_ratio_usdt = String(transfer_fee_ratio_usdt);
            newSettings.withdrawal_fee_usdt = String(withdrawal_fee_usdt);
            newSettings.network_fee_usdt = String(network_fee_usdt);
        }

        // 2. SMTP configurations (if provided)
        if (smtp_host !== undefined) newSettings.smtp_host = String(smtp_host).trim();
        if (smtp_port !== undefined) newSettings.smtp_port = String(smtp_port).trim();
        if (smtp_secure !== undefined) newSettings.smtp_secure = String(smtp_secure);
        if (smtp_user !== undefined) newSettings.smtp_user = String(smtp_user).trim();
        if (smtp_pass !== undefined) newSettings.smtp_pass = String(smtp_pass).trim();
        if (smtp_from !== undefined) newSettings.smtp_from = String(smtp_from).trim();
        if (smtp_from_name !== undefined) newSettings.smtp_from_name = String(smtp_from_name).trim();
        if (smtp_enabled !== undefined) newSettings.smtp_enabled = String(smtp_enabled);

        await db.updateSettings(newSettings);

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_update_settings',
            details: `Admin updated platform settings. ${newSettings.smtp_host ? `Configured SMTP host: ${newSettings.smtp_host}` : ''}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        const allSettings = await db.getSettings();
        return NextResponse.json({ message: "Settings updated successfully.", settings: allSettings }, { status: 200 });

    } catch (error) {
        console.error("Admin save settings error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
