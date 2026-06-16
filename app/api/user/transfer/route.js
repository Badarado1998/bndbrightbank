import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

// GET: Lookup recipient by account number
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const accountNumber = searchParams.get('accountNumber');

        if (!accountNumber) {
            return NextResponse.json({ error: "Account number is required." }, { status: 400 });
        }

        const recipient = await db.getUserByAccountNumber(accountNumber);
        if (!recipient) {
            return NextResponse.json({ error: "Account not found." }, { status: 404 });
        }

        if (recipient.id === session.id) {
            return NextResponse.json({ error: "Cannot transfer to yourself." }, { status: 400 });
        }

        if (recipient.status !== 'active') {
            return NextResponse.json({ error: "Recipient account is currently suspended." }, { status: 400 });
        }

        return NextResponse.json({
            name: recipient.name,
            account_number: recipient.account_number
        }, { status: 200 });

    } catch (error) {
        console.error("Recipient lookup error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

// POST: Execute USD internal transfer
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const body = await request.json();
        const { recipientAccountNumber, amount: rawAmount } = body;
        const amount = parseFloat(rawAmount);

        if (!recipientAccountNumber || isNaN(amount) || amount <= 0) {
            return NextResponse.json({ error: "Invalid transfer parameters." }, { status: 400 });
        }

        const senderId = session.id;

        // 1. Fetch recipient
        const recipient = await db.getUserByAccountNumber(recipientAccountNumber);
        if (!recipient) {
            return NextResponse.json({ error: "Recipient account not found." }, { status: 404 });
        }

        if (recipient.id === senderId) {
            return NextResponse.json({ error: "Cannot transfer to yourself." }, { status: 400 });
        }

        if (recipient.status !== 'active') {
            return NextResponse.json({ error: "Recipient account is suspended." }, { status: 400 });
        }

        // 2. Fetch sender balance and verify
        const senderBalances = await db.getBalances(senderId);
        if (senderBalances.usd_balance < amount) {
            return NextResponse.json({ error: "insufficient USDT recipient must upload usdt to make this transaction successful" }, { status: 400 });
        }

        // 3. Calculate USDT Fee
        const settings = await db.getSettings();
        const ratioUsd = parseFloat(settings.transfer_fee_ratio_usd || 5000);
        const ratioUsdt = parseFloat(settings.transfer_fee_ratio_usdt || 1);
        const usdtFee = Math.max(ratioUsdt || 1, Math.floor(amount / ratioUsd) * ratioUsdt);

        // 4. Verify sender USDT fee balance
        const usdtWallet = senderBalances.crypto['USDT'];
        const usdtBalance = usdtWallet ? usdtWallet.balance : 0;
        if (usdtFee > 0 && usdtBalance < usdtFee) {
            return NextResponse.json({
                error: "recipient must add usdt for network fee",
                showFeePopup: true
            }, { status: 400 });
        }

        // 5. Execute transfer atomically
        await db.executeTransfer({
            sender_id: senderId,
            receiver_id: recipient.id,
            amount,
            usdt_fee: usdtFee
        });

        // Audit Log
        await db.createAuditLog({
            user_id: senderId,
            action: 'transfer',
            details: `Transferred $${amount} USD to ${recipient.name} (Acct: ${recipient.account_number}). Fee: ${usdtFee} USDT`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({
            message: "Transfer completed successfully.",
            amount,
            fee: usdtFee,
            recipient: recipient.name
        }, { status: 200 });

    } catch (error) {
        console.error("Transfer execution API error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}
