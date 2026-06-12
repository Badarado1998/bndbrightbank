import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

async function checkAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

// GET: List all deposit methods & all available coins
export async function GET(request) {
    try {
        if (!await checkAdmin()) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }
        const methods = await db.getDepositMethods();
        const allCoins = await db.getCoins();
        return NextResponse.json({ methods, allCoins }, { status: 200 });
    } catch (error) {
        console.error("Admin list deposit methods error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// POST: Create a new deposit method
export async function POST(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { coinId, walletAddress, depositAmount, usdCredit } = body;

        if (!coinId || !walletAddress || isNaN(parseFloat(depositAmount)) || isNaN(parseFloat(usdCredit))) {
            return NextResponse.json({ error: "Invalid parameters. All fields are required." }, { status: 400 });
        }

        const method = await db.createDepositMethod({
            coin_id: parseInt(coinId),
            wallet_address: walletAddress,
            deposit_amount: parseFloat(depositAmount),
            usd_credit: parseFloat(usdCredit)
        });

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_create_deposit_method',
            details: `Created deposit method: Coin ID ${coinId}, Addr: ${walletAddress}, Amt: ${depositAmount}, USD: ${usdCredit}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Deposit method created successfully.", method }, { status: 201 });

    } catch (error) {
        console.error("Admin create deposit method error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// PUT: Edit deposit method
export async function PUT(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { id, coinId, walletAddress, depositAmount, usdCredit } = body;

        if (!id || !coinId || !walletAddress || isNaN(parseFloat(depositAmount)) || isNaN(parseFloat(usdCredit))) {
            return NextResponse.json({ error: "Invalid parameters. All fields are required." }, { status: 400 });
        }

        const updated = await db.updateDepositMethod(parseInt(id), {
            coin_id: parseInt(coinId),
            wallet_address: walletAddress,
            deposit_amount: parseFloat(depositAmount),
            usd_credit: parseFloat(usdCredit)
        });

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_update_deposit_method',
            details: `Updated deposit method ID ${id}: Coin ID ${coinId}, Addr: ${walletAddress}, Amt: ${depositAmount}, USD: ${usdCredit}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Deposit method updated successfully.", method: updated }, { status: 200 });

    } catch (error) {
        console.error("Admin update deposit method error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// DELETE: Delete deposit method
export async function DELETE(request) {
    try {
        const admin = await checkAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Deposit method ID is required." }, { status: 400 });
        }

        await db.deleteDepositMethod(parseInt(id));

        // Audit Log
        await db.createAuditLog({
            user_id: admin.id,
            action: 'admin_delete_deposit_method',
            details: `Deleted deposit method ID ${id}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({ message: "Deposit method deleted successfully." }, { status: 200 });

    } catch (error) {
        console.error("Admin delete deposit method error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
