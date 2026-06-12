import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

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

        if (!withdrawalId || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters." }, { status: 400 });
        }

        const wId = parseInt(withdrawalId);

        if (action === 'approve') {
            await db.approveWithdrawal(wId);
        } else {
            await db.rejectWithdrawal(wId);
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
