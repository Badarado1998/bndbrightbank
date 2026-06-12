import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

// GET: List all deposit requests
export async function GET(request) {
    try {
        if (!await checkAdmin()) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }
        const deposits = await db.getDeposits();
        return NextResponse.json({ deposits }, { status: 200 });
    } catch (error) {
        console.error("Admin list deposits error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// POST: Approve or Reject deposit
export async function POST(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { depositId, action } = body;

        if (!depositId || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters." }, { status: 400 });
        }

        const depId = parseInt(depositId);
        
        if (action === 'approve') {
            await db.approveDeposit(depId);
        } else {
            await db.rejectDeposit(depId);
        }

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: `admin_${action}_deposit`,
            details: `Admin ${action}d deposit request ID ${depId}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: `Deposit request successfully ${action}d.` }, { status: 200 });

    } catch (error) {
        console.error("Admin process deposit error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}
