import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { sendDepositApprovedEmail } from '@/lib/mailer';

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

            // Notify user of approved deposit via email
            try {
                const allDeps = await db.getDeposits();
                const targetDep = allDeps.find(d => d.id === depId);
                if (targetDep) {
                    const userObj = targetDep.users || { name: targetDep.user_name, email: targetDep.user_email };
                    const creditAmt = targetDep.usd_credit || (targetDep.deposit_methods && targetDep.deposit_methods.usd_credit);
                    sendDepositApprovedEmail({
                        user: userObj,
                        deposit: targetDep,
                        creditAmount: creditAmt
                    }).catch(e => console.warn("[Mailer] Deposit approved email error:", e.message));
                }
            } catch (mailErr) {
                console.warn("[Mailer] Error preparing deposit notification:", mailErr.message);
            }
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
