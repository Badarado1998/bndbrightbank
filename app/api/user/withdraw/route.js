import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { bankName, accountName, accountNumber, amount: rawAmount } = body;
        const amount = parseFloat(rawAmount);

        if (!bankName || !accountName || !accountNumber || isNaN(amount) || amount <= 0) {
            return NextResponse.json({ error: "All bank details and a positive amount are required." }, { status: 400 });
        }

        const userId = session.id;

        // 1. Fetch current balances
        const balances = await db.getBalances(userId);
        if (balances.usd_balance < amount) {
            return NextResponse.json({ error: "Insufficient USD bank balance." }, { status: 400 });
        }

        // 2. Fetch withdrawal network fee setting
        const settings = await db.getSettings();
        const networkFee = parseFloat(settings.network_fee_usdt || 5);

        // 3. Verify USDT balance
        const usdtWallet = balances.crypto['USDT'];
        const usdtBalance = usdtWallet ? usdtWallet.balance : 0;

        if (usdtBalance <= 0) {
            return NextResponse.json({
                error: "Network fee payment required. Please maintain sufficient USDT balance before withdrawal.",
                showFeePopup: true
            }, { status: 400 });
        }

        if (usdtBalance < networkFee) {
            return NextResponse.json({
                error: `Insufficient USDT balance for withdrawal network fee of ${networkFee} USDT. Please top up your USDT wallet.`,
                showFeePopup: true
            }, { status: 400 });
        }

        // 4. Process withdrawal request
        await db.executeWithdrawalRequest({
            user_id: userId,
            bank_name: bankName,
            account_name: accountName,
            account_number: accountNumber,
            amount,
            fee: networkFee
        });

        // Audit Log
        await db.createAuditLog({
            user_id: userId,
            action: 'withdraw_request',
            details: `Requested withdrawal of $${amount} USD to ${bankName} (Acct: ${accountNumber}). Fee: ${networkFee} USDT deducted.`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({
            message: "Withdrawal request submitted successfully. Awaiting admin approval.",
            amount,
            fee: networkFee
        }, { status: 201 });

    } catch (error) {
        console.error("Withdrawal request API error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}
