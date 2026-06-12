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
        const { transfer_fee_ratio_usd, transfer_fee_ratio_usdt, withdrawal_fee_usdt, network_fee_usdt } = body;

        // Validation
        if (isNaN(parseFloat(transfer_fee_ratio_usd)) ||
            isNaN(parseFloat(transfer_fee_ratio_usdt)) ||
            isNaN(parseFloat(withdrawal_fee_usdt)) ||
            isNaN(parseFloat(network_fee_usdt))) {
            return NextResponse.json({ error: "All fee settings must be valid numbers." }, { status: 400 });
        }

        const newSettings = {
            transfer_fee_ratio_usd: String(transfer_fee_ratio_usd),
            transfer_fee_ratio_usdt: String(transfer_fee_ratio_usdt),
            withdrawal_fee_usdt: String(withdrawal_fee_usdt),
            network_fee_usdt: String(network_fee_usdt)
        };

        await db.updateSettings(newSettings);

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_update_settings',
            details: `Admin updated fee settings: Transfer Ratio: every $${transfer_fee_ratio_usd} requires ${transfer_fee_ratio_usdt} USDT. Withdrawal Fee: ${withdrawal_fee_usdt} USDT. Network Fee: ${network_fee_usdt} USDT.`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Settings updated successfully.", settings: newSettings }, { status: 200 });

    } catch (error) {
        console.error("Admin save settings error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
