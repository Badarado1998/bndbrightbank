import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const notifications = await db.getUserNotifications(session.id);
        
        // Normalize is_read field for unified UI consumption (SQLite returns 0/1, Supabase returns true/false)
        const normalized = notifications.map(n => ({
            ...n,
            is_read: n.is_read === true || n.is_read === 1 || n.is_read === 'true'
        }));

        return NextResponse.json({ notifications: normalized }, { status: 200 });
    } catch (error) {
        console.error("GET user notifications error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { id } = body; // Optional specific notification ID

        if (id) {
            await db.markNotificationRead(id, session.id);
        } else {
            await db.markAllNotificationsRead(session.id);
        }

        return NextResponse.json({ message: "Notifications updated successfully." }, { status: 200 });
    } catch (error) {
        console.error("PUT user notifications error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
