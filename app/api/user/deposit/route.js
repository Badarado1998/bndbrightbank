import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const formData = await request.formData();
        const methodIdRaw = formData.get('methodId');
        const proofFile = formData.get('proof'); // This is a File object

        if (!methodIdRaw || !proofFile) {
            return NextResponse.json({ error: "Deposit method and payment proof are required." }, { status: 400 });
        }

        const methodId = parseInt(methodIdRaw);
        if (isNaN(methodId)) {
            return NextResponse.json({ error: "Invalid deposit method." }, { status: 400 });
        }

        // Verify deposit method exists
        const method = await db.getDepositMethodById(methodId);
        if (!method) {
            return NextResponse.json({ error: "Deposit method not found." }, { status: 404 });
        }

        // 1. Process and save the file
        const buffer = Buffer.from(await proofFile.arrayBuffer());
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
        await fs.mkdir(uploadDir, { recursive: true });

        // Create a unique, clean filename
        const safeName = proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${Date.now()}-${safeName}`;
        const filepath = path.join(uploadDir, filename);

        await fs.writeFile(filepath, buffer);
        const proofPath = `/uploads/proofs/${filename}`;

        // 2. Write deposit request to DB
        const deposit = await db.createDepositRequest({
            user_id: session.id,
            method_id: methodId,
            proof: proofPath
        });

        // Audit Log
        const coinSymbol = method.coin_symbol || (method.coins && method.coins.symbol) || 'USDT';
        await db.createAuditLog({
            user_id: session.id,
            action: 'deposit_request',
            details: `Requested deposit of ${method.deposit_amount} ${coinSymbol} for $${method.usd_credit} USD. Proof: ${proofPath}`,
            ip_address: request.headers.get('x-forwarded-for') || ''
        });

        return NextResponse.json({
            message: "Deposit submitted successfully. Verification pending admin approval.",
            deposit
        }, { status: 201 });

    } catch (error) {
        console.error("Deposit request API error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}

