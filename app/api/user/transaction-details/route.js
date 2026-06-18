import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: "Transaction ID is required." }, { status: 400 });
        }

        const userId = session.id;

        // Fetch transaction
        const transaction = await db.getTransactionById(id);
        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
        }

        // Verify ownership
        if (transaction.user_id !== userId) {
            return NextResponse.json({ error: "Unauthorized access to transaction details." }, { status: 403 });
        }

        let details = null;

        // Match based on transaction type
        if (transaction.type === 'deposit') {
            const deposits = await db.getUserDeposits(userId);
            
            // Extract USD credit from transaction amount string, e.g. "+100.00 USD / +10.00 USDT" -> 100.00
            const amtStr = transaction.amount;
            const match = amtStr.match(/\+?\$?([0-9.,]+)\s*USD/);
            const usdAmount = match ? parseFloat(match[1].replace(/,/g, '')) : null;

            // Find matching deposit using time proximity and amount
            const txTime = new Date(transaction.created_at).getTime();
            let bestMatch = null;
            let bestDiff = Infinity;

            for (const d of deposits) {
                // Normalize deposit structure
                const walletAddress = d.wallet_address || (d.deposit_methods ? d.deposit_methods.wallet_address : '');
                const depositAmount = d.deposit_amount || (d.deposit_methods ? d.deposit_methods.deposit_amount : 0);
                const usdCredit = d.usd_credit || (d.deposit_methods ? d.deposit_methods.usd_credit : 0);
                const coinSymbol = d.coin_symbol || (d.deposit_methods && d.deposit_methods.coins ? d.deposit_methods.coins.symbol : (d.deposit_methods ? d.deposit_methods.coin_symbol : 'USDT'));

                const dTime = new Date(d.created_at).getTime();
                const diff = Math.abs(txTime - dTime);

                // If usdAmount parsed successfully, check match, else just match by time
                const isAmountMatch = usdAmount !== null ? Math.abs(usdCredit - usdAmount) < 0.01 : true;

                if (isAmountMatch && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = {
                        id: d.id,
                        proof: d.proof,
                        status: d.status,
                        created_at: d.created_at,
                        wallet_address: walletAddress,
                        deposit_amount: depositAmount,
                        usd_credit: usdCredit,
                        coin_symbol: coinSymbol
                    };
                }
            }

            // Fallback: if no amount match found, pick the closest deposit by time
            if (!bestMatch && deposits.length > 0) {
                let minDiff = Infinity;
                let closest = null;
                for (const d of deposits) {
                    const dTime = new Date(d.created_at).getTime();
                    const diff = Math.abs(txTime - dTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = d;
                    }
                }
                if (closest) {
                    const walletAddress = closest.wallet_address || (closest.deposit_methods ? closest.deposit_methods.wallet_address : '');
                    const depositAmount = closest.deposit_amount || (closest.deposit_methods ? closest.deposit_methods.deposit_amount : 0);
                    const usdCredit = closest.usd_credit || (closest.deposit_methods ? closest.deposit_methods.usd_credit : 0);
                    const coinSymbol = closest.coin_symbol || (closest.deposit_methods && closest.deposit_methods.coins ? closest.deposit_methods.coins.symbol : (closest.deposit_methods ? closest.deposit_methods.coin_symbol : 'USDT'));

                    bestMatch = {
                        id: closest.id,
                        proof: closest.proof,
                        status: closest.status,
                        created_at: closest.created_at,
                        wallet_address: walletAddress,
                        deposit_amount: depositAmount,
                        usd_credit: usdCredit,
                        coin_symbol: coinSymbol
                    };
                }
            }

            details = bestMatch;

        } else if (transaction.type === 'withdrawal') {
            const withdrawals = await db.getUserWithdrawals(userId);
            
            // Transaction amount can be USD (e.g. "-$100 USD") or USDT fee (e.g. "-5.00 USDT" / "Withdrawal network fee")
            const amtStr = transaction.amount;
            const isFeeTx = transaction.description.toLowerCase().includes('fee') || amtStr.includes('USDT');
            const parsedVal = parseFloat(amtStr.replace(/[^0-9.]/g, ''));

            const txTime = new Date(transaction.created_at).getTime();
            let bestMatch = null;
            let bestDiff = Infinity;

            for (const w of withdrawals) {
                const wTime = new Date(w.created_at).getTime();
                const diff = Math.abs(txTime - wTime);

                const isValueMatch = isFeeTx 
                    ? Math.abs(w.fee - parsedVal) < 0.01 
                    : Math.abs(w.amount - parsedVal) < 0.01;

                if (isValueMatch && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = w;
                }
            }

            // Fallback: pick the closest withdrawal in time
            if (!bestMatch && withdrawals.length > 0) {
                let minDiff = Infinity;
                let closest = null;
                for (const w of withdrawals) {
                    const wTime = new Date(w.created_at).getTime();
                    const diff = Math.abs(txTime - wTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = w;
                    }
                }
                bestMatch = closest;
            }

            if (bestMatch) {
                // If it is a fee transaction, mark it as a fee detail
                details = {
                    id: bestMatch.id,
                    bank_name: bestMatch.bank_name,
                    account_name: bestMatch.account_name,
                    account_number: bestMatch.account_number,
                    amount: bestMatch.amount,
                    fee: bestMatch.fee,
                    status: bestMatch.status,
                    withdrawal_method: bestMatch.withdrawal_method || 'bank',
                    card_number_masked: bestMatch.card_number_masked,
                    card_holder_name: bestMatch.card_holder_name,
                    card_type: bestMatch.card_type,
                    created_at: bestMatch.created_at,
                    is_fee_only: isFeeTx
                };
            }

        } else if (transaction.type === 'transfer_sent' || transaction.type === 'transfer_received') {
            const transfers = await db.getUserTransfers(userId);

            const amtStr = transaction.amount;
            const isFeeTx = transaction.description.toLowerCase().includes('fee') || amtStr.includes('USDT');
            const parsedVal = parseFloat(amtStr.replace(/[^0-9.]/g, ''));

            const txTime = new Date(transaction.created_at).getTime();
            let bestMatch = null;
            let bestDiff = Infinity;

            for (const t of transfers) {
                const tTime = new Date(t.created_at).getTime();
                const diff = Math.abs(txTime - tTime);

                const isValueMatch = isFeeTx 
                    ? Math.abs(t.usdt_fee - parsedVal) < 0.01 
                    : Math.abs(t.amount - parsedVal) < 0.01;

                if (isValueMatch && diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = t;
                }
            }

            // Fallback: pick closest transfer in time
            if (!bestMatch && transfers.length > 0) {
                let minDiff = Infinity;
                let closest = null;
                for (const t of transfers) {
                    const tTime = new Date(t.created_at).getTime();
                    const diff = Math.abs(txTime - tTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = t;
                    }
                }
                bestMatch = closest;
            }

            if (bestMatch) {
                details = {
                    id: bestMatch.id,
                    sender_name: bestMatch.sender_name || (bestMatch.sender ? bestMatch.sender.name : 'Unknown'),
                    sender_account: bestMatch.sender_account || (bestMatch.sender ? bestMatch.sender.account_number : ''),
                    receiver_name: bestMatch.receiver_name || (bestMatch.receiver ? bestMatch.receiver.name : 'Unknown'),
                    receiver_account: bestMatch.receiver_account || (bestMatch.receiver ? bestMatch.receiver.account_number : ''),
                    amount: bestMatch.amount,
                    fee: bestMatch.usdt_fee,
                    created_at: bestMatch.created_at,
                    is_fee_only: isFeeTx
                };
            }
        }

        // Return unified details response
        return NextResponse.json({
            transaction,
            details
        }, { status: 200 });

    } catch (error) {
        console.error("Transaction details API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
