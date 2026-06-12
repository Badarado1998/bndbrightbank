import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/session';
import db from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getSession();
        if (session) {
            await db.createAuditLog({
                user_id: session.id,
                action: 'logout',
                details: `User logged out.`,
                ip_address: request.headers.get('x-forwarded-for') || ''
            });
        }
        await clearSession();
        return NextResponse.json({ message: "Logout successful." }, { status: 200 });
    } catch (error) {
        console.error("Logout API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
