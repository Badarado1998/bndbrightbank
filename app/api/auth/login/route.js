import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { setSession } from '@/lib/session';

export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // 1. Validation
        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }

        // 2. Fetch User
        const user = await db.getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
        }

        // 3. Verify Status
        if (user.status === 'suspended') {
            return NextResponse.json({ error: "Your account has been suspended. Please contact support." }, { status: 403 });
        }

        // 4. Verify Password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
        }

        // 5. Establish Session
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            account_number: user.account_number,
            routing_number: user.routing_number,
            must_change_password: user.must_change_password
        };
        await setSession(sessionUser);

        // Audit Log
        await db.createAuditLog({
            user_id: user.id,
            action: 'login',
            details: `User logged in. Role: ${user.role}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({
            message: "Login successful.",
            user: sessionUser
        }, { status: 200 });

    } catch (error) {
        console.error("Login API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
