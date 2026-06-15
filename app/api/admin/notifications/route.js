import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
        }

        const body = await request.json();
        const { userId, title, message } = body;

        if (!userId || !title || !message) {
            return NextResponse.json({ error: "Missing required fields (userId, title, message)." }, { status: 400 });
        }

        const user = await db.getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const greeting = `Hello ${user.name},\n\n`;
        const fullMessage = message.trim().startsWith('Hello') || message.trim().startsWith('Dear')
            ? message
            : greeting + message;

        await db.createNotification({ userId, title, message: fullMessage });

        // Audit Log
        await db.createAuditLog({
            user_id: session.id,
            action: 'send_notification',
            details: `Sent message to User: ${user.name} (${user.email}). Title: "${title}". Message: "${fullMessage}"`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Notification sent successfully." }, { status: 201 });
    } catch (error) {
        console.error("POST admin notifications error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
