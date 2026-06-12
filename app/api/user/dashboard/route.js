import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const userId = session.id;

        // Fetch user data
        const balances = await db.getBalances(userId);
        const transactions = await db.getTransactions(userId);
        const depositMethods = await db.getDepositMethods();
        const settings = await db.getSettings();
        const coins = await db.getActiveCoins();

        return NextResponse.json({
            usd_balance: balances.usd_balance,
            crypto_balances: balances.crypto,
            transactions,
            deposit_methods: depositMethods,
            settings,
            coins
        }, { status: 200 });

    } catch (error) {
        console.error("User dashboard API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
