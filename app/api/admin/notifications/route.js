import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import { sendAdminMessageEmail } from '@/lib/mailer';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Missing required parameter: userId." }, { status: 400 });
        }

        const notifications = await db.getUserNotifications(userId);
        return NextResponse.json({ notifications }, { status: 200 });
    } catch (error) {
        console.error("GET admin notifications error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
        }

        const body = await request.json();
        let { userId, title, message } = body;

        if (!title || !title.trim()) {
            title = 'Message from Admin';
        }

        if (!userId || !message || !message.trim()) {
            return NextResponse.json({ error: "Missing required fields (userId, message)." }, { status: 400 });
        }

        const user = await db.getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        await db.createNotification({ userId, title, message: message.trim(), senderRole: 'admin' });

        // Send email alert to user
        sendAdminMessageEmail({ user, title, message: message.trim() }).catch(e => console.warn('[Mailer] Admin message email error:', e.message));

        // Audit Log
        await db.createAuditLog({
            user_id: session.id,
            action: 'send_notification',
            details: `Sent message to User: ${user.name} (${user.email}). Title: "${title}". Message: "${message.trim()}"`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Notification sent successfully." }, { status: 201 });
    } catch (error) {
        console.error("POST admin notifications error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
