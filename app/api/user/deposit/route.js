import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { sendDepositRequestEmail } from '@/lib/mailer';

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
        let proofPath = "";

        if (db.getMode() === 'supabase') {
            const supabase = require('@/lib/supabase');
            
            // Create a unique, clean filename
            const safeName = proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `${Date.now()}-${safeName}`;
            const contentType = proofFile.type || 'image/jpeg';

            // 1. Resolve or auto-create public bucket ('proofs' or 'proof')
            let activeBucket = 'proofs';
            if (supabase && typeof supabase.ensureProofBucket === 'function') {
                try {
                    activeBucket = await supabase.ensureProofBucket(supabase);
                } catch (bErr) {
                    console.warn("[Deposit Upload] ensureProofBucket warning:", bErr?.message);
                }
            }

            // 2. Upload with retry & alternate bucket fallback
            let uploadSuccess = false;
            let uploadError = null;
            const bucketsToTry = [activeBucket, activeBucket === 'proofs' ? 'proof' : 'proofs'];

            for (const bName of bucketsToTry) {
                try {
                    const { error: err } = await supabase.storage
                        .from(bName)
                        .upload(filename, buffer, {
                            contentType,
                            duplex: 'half',
                            upsert: true
                        });

                    if (!err) {
                        activeBucket = bName;
                        uploadSuccess = true;
                        uploadError = null;
                        break;
                    } else {
                        uploadError = err;
                        console.warn(`[Supabase Storage] Upload to '${bName}' failed:`, err.message);

                        // If bucket not found, attempt to create it with public access and retry
                        try {
                            await supabase.storage.createBucket(bName, { public: true, fileSizeLimit: 52428800 });
                            const retry = await supabase.storage
                                .from(bName)
                                .upload(filename, buffer, {
                                    contentType,
                                    duplex: 'half',
                                    upsert: true
                                });
                            if (!retry.error) {
                                activeBucket = bName;
                                uploadSuccess = true;
                                uploadError = null;
                                break;
                            }
                        } catch (createErr) {
                            // Proceed to alternative bucket
                        }
                    }
                } catch (tryErr) {
                    uploadError = tryErr;
                }
            }

            if (uploadSuccess) {
                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from(activeBucket)
                    .getPublicUrl(filename);

                proofPath = publicUrl;
            } else {
                console.error("Supabase Storage upload failed across all buckets:", uploadError);
                // Resilient fallback: Save to local public storage or encode as Base64 Data URL so transaction is never blocked
                try {
                    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
                    await fs.mkdir(uploadDir, { recursive: true });
                    const filepath = path.join(uploadDir, filename);
                    await fs.writeFile(filepath, buffer);
                    proofPath = `/uploads/proofs/${filename}`;
                } catch (fsErr) {
                    proofPath = `data:${contentType};base64,${buffer.toString('base64')}`;
                }
            }
        } else {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
            await fs.mkdir(uploadDir, { recursive: true });

            // Create a unique, clean filename
            const safeName = proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `${Date.now()}-${safeName}`;
            const filepath = path.join(uploadDir, filename);

            await fs.writeFile(filepath, buffer);
            proofPath = `/uploads/proofs/${filename}`;
        }

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

        // Send email notification to user asynchronously
        sendDepositRequestEmail({
            user: session,
            deposit,
            method: {
                usd_credit: method.usd_credit,
                deposit_amount: method.deposit_amount,
                coin_symbol: coinSymbol
            }
        }).catch(err => {
            console.warn("[Mailer] Deposit request email error:", err.message);
        });

        return NextResponse.json({
            message: "Deposit submitted successfully. Verification pending admin approval.",
            deposit
        }, { status: 201 });

    } catch (error) {
        console.error("Deposit request API error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}

