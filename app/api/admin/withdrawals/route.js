import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { sendWithdrawalStatusEmail } from '@/lib/mailer';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

// GET: List all withdrawal requests
export async function GET(request) {
    try {
        if (!await checkAdmin()) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }
        const withdrawals = await db.getWithdrawals();
        return NextResponse.json({ withdrawals }, { status: 200 });
    } catch (error) {
        console.error("Admin list withdrawals error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// POST: Approve or Reject withdrawal
export async function POST(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { withdrawalId, action } = body;

        if (!withdrawalId || !action || !['approve', 'reject', 'return', 'decline', 'hold'].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters." }, { status: 400 });
        }

        const wId = parseInt(withdrawalId);

        await db.processWithdrawal(wId, action);

        // Fetch withdrawal record to notify user via email
        try {
            const allW = await db.getWithdrawals();
            const targetW = allW.find(item => item.id === wId);
            if (targetW) {
                const userObj = targetW.users || { name: targetW.user_name, email: targetW.user_email };
                sendWithdrawalStatusEmail({
                    user: userObj,
                    withdrawal: targetW,
                    action
                }).catch(e => console.warn("[Mailer] Withdrawal status email error:", e.message));
            }
        } catch (mailErr) {
            console.warn("[Mailer] Error preparing withdrawal notification:", mailErr.message);
        }

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: `admin_${action}_withdrawal`,
            details: `Admin ${action}d withdrawal request ID ${wId}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: `Withdrawal request successfully ${action}d.` }, { status: 200 });

    } catch (error) {
        console.error("Admin process withdrawal error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}
