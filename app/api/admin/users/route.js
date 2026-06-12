import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

// Verify admin helper
async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return null;
    }
    return session;
}

// GET: List all users with balances
export async function GET(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const users = await db.getUsers();
        return NextResponse.json({ users }, { status: 200 });

    } catch (error) {
        console.error("Admin user list error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// PUT: Edit user details & balances
export async function PUT(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { userId, name, status, role, usdBalance, cryptoBalances } = body;

        if (!userId) {
            return NextResponse.json({ error: "User ID is required." }, { status: 400 });
        }

        // Fetch current user details
        const user = await db.getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        // 1. Update basic info (status, role)
        if (status && status !== user.status) {
            await db.updateUserStatus(userId, status);
        }

        if (role && role !== user.role) {
            // Update role if changed
            if (isSupabase) {
                const { error } = await supabase.from('users').update({ role }).eq('id', userId);
                if (error) throw error;
            } else {
                await sqlite.run(`UPDATE users SET role = ? WHERE id = ?`, [role, userId]);
            }
        }

        if (name && name !== user.name) {
            // Update name
            if (isSupabase) {
                const { error } = await supabase.from('users').update({ name }).eq('id', userId);
                if (error) throw error;
            } else {
                await sqlite.run(`UPDATE users SET name = ? WHERE id = ?`, [name, userId]);
            }
        }

        // 2. Update balances (Admin manual adjustments)
        const newUsd = parseFloat(usdBalance);
        if (!isNaN(newUsd)) {
            await db.adjustUserBalances(userId, newUsd, cryptoBalances || {});
        }

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_edit_user',
            details: `Admin modified user ${user.email} (Name: ${name}, Status: ${status}, USD: ${usdBalance})`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "User updated successfully." }, { status: 200 });

    } catch (error) {
        console.error("Admin edit user error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// DELETE: Delete user account
export async function DELETE(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "User ID is required." }, { status: 400 });
        }

        const user = await db.getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        if (user.role === 'admin') {
            return NextResponse.json({ error: "Cannot delete admin accounts." }, { status: 400 });
        }

        await db.deleteUser(userId);

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_delete_user',
            details: `Admin deleted user account: ${user.email}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "User account deleted successfully." }, { status: 200 });

    } catch (error) {
        console.error("Admin delete user error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// Check helper variables
const isSupabase = db.getMode() === 'supabase';
const sqlite = require('@/lib/sqlite');
const supabase = require('@/lib/supabase');
