import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { setSession } from '@/lib/session';

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, email, password, confirmPassword } = body;

        // 1. Validation
        if (!name || !email || !password || !confirmPassword) {
            return NextResponse.json({ error: "All fields are required." }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
        }

        // 2. Check if user already exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ error: "Email already registered." }, { status: 400 });
        }

        // 3. Generate Unique Account & Routing Numbers
        let account_number = "";
        let isUnique = false;
        while (!isUnique) {
            account_number = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit
            const existingAcct = await db.getUserByAccountNumber(account_number);
            if (!existingAcct) {
                isUnique = true;
            }
        }
        const routing_number = Math.floor(100000000 + Math.random() * 900000000).toString(); // 9-digit

        // 4. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Create user
        const newUser = await db.createUser({
            name,
            email,
            password: hashedPassword,
            account_number,
            routing_number,
            role: 'user'
        });

        // 6. Establish Session
        const sessionUser = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            account_number: newUser.account_number,
            routing_number: newUser.routing_number
        };
        await setSession(sessionUser);

        // Audit Log
        await db.createAuditLog({
            user_id: newUser.id,
            action: 'register',
            details: `User registered successfully. Acct: ${account_number}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({
            message: "Registration successful.",
            user: sessionUser
        }, { status: 201 });

    } catch (error) {
        console.error("Registration API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
