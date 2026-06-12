import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function GET(request) {
    try {
        if (!await checkAdmin()) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }
        const logs = await db.getAuditLogs();
        return NextResponse.json({ logs }, { status: 200 });
    } catch (error) {
        console.error("Admin fetch audit logs error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
