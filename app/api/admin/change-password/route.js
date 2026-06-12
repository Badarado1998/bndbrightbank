import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { getSession, setSession } from '@/lib/session';

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: "Access denied." }, { status: 403 });
        }

        const body = await request.json();
        const { newPassword, confirmPassword } = body;

        // 1. Validation
        if (!newPassword || !confirmPassword) {
            return NextResponse.json({ error: "All fields are required." }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
        }

        // 2. Hash and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.updateUserPassword(session.id, hashedPassword, 0); // Updates must_change_password = 0

        // 3. Update Session
        const updatedSession = {
            ...session,
            must_change_password: 0
        };
        await setSession(updatedSession);

        // Audit Log
        await db.createAuditLog({
            user_id: session.id,
            action: 'admin_change_password',
            details: `Admin successfully updated password on first login.`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });

    } catch (error) {
        console.error("Admin change password error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
