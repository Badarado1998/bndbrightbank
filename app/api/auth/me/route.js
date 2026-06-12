import { NextResponse } from 'next/server';
import { getSession, clearSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        // Verify status dynamically in database
        const dbUser = await db.getUserById(session.id);
        if (!dbUser || dbUser.status === 'suspended') {
            await clearSession();
            return NextResponse.json({ authenticated: false, error: "Account suspended or deleted." }, { status: 401 });
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
                account_number: dbUser.account_number,
                routing_number: dbUser.routing_number,
                country: dbUser.country || 'United States',
                must_change_password: dbUser.must_change_password
            }
        });
    } catch (error) {
        console.error("Auth me API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
