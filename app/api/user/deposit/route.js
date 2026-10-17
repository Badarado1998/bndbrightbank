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
        let proofPath = "";
        const mimeType = proofFile.type || 'image/jpeg';
        const safeName = proofFile.name ? proofFile.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'receipt.png';
        const filename = `${Date.now()}-${safeName}`;

        if (db.getMode() === 'supabase') {
            const supabase = require('@/lib/supabase');
            let uploadSuccess = false;

            if (supabase && supabase.storage) {
                // Ensure bucket candidates: 'proof' first (user requirement), followed by 'proofs'
                const candidateBuckets = ['proof', 'proofs'];
                let preferredBucket = 'proof';

                if (typeof supabase.ensureProofBucket === 'function') {
                    preferredBucket = await supabase.ensureProofBucket().catch(() => 'proof');
                }

                // Order candidate buckets with preferred first
                const bucketsToTry = Array.from(new Set([preferredBucket, ...candidateBuckets]));

                for (const bucket of bucketsToTry) {
                    try {
                        // 1. Ensure bucket exists and has public access
                        try {
                            const { data: bInfo, error: bErr } = await supabase.storage.getBucket(bucket);
                            if (bErr || !bInfo) {
                                await supabase.storage.createBucket(bucket, {
                                    public: true,
                                    fileSizeLimit: 10485760 // 10MB
                                }).catch(() => {});
                            } else if (!bInfo.public) {
                                await supabase.storage.updateBucket(bucket, { public: true }).catch(() => {});
                            }
                        } catch (_) {}

                        // 2. Upload file to bucket
                        let { data: uploadData, error: uploadError } = await supabase.storage
                            .from(bucket)
                            .upload(filename, buffer, {
                                contentType: mimeType,
                                upsert: true
                            });

                        // 3. If bucket not found error, attempt explicit creation and retry
                        if (uploadError && (
                            uploadError.message?.toLowerCase().includes('not found') ||
                            uploadError.statusCode === '404' ||
                            uploadError.statusCode === 404
                        )) {
                            await supabase.storage.createBucket(bucket, {
                                public: true,
                                fileSizeLimit: 10485760
                            }).catch(() => {});

                            const retry = await supabase.storage
                                .from(bucket)
                                .upload(filename, buffer, {
                                    contentType: mimeType,
                                    upsert: true
                                });
                            uploadData = retry.data;
                            uploadError = retry.error;
                        }

                        if (!uploadError && uploadData) {
                            // Ensure public flag is true
                            await supabase.storage.updateBucket(bucket, { public: true }).catch(() => {});

                            const { data: { publicUrl } } = supabase.storage
                                .from(bucket)
                                .getPublicUrl(filename);

                            proofPath = publicUrl;
                            uploadSuccess = true;
                            break;
                        } else if (uploadError) {
                            console.warn(`Supabase Storage upload to bucket '${bucket}' failed:`, uploadError.message || uploadError);
                        }
                    } catch (attemptErr) {
                        console.warn(`Error attempting upload to '${bucket}':`, attemptErr.message);
                    }
                }
            }

            // Fallback: If Supabase Storage upload was not possible (storage down, RLS, missing config),
            // store proof as a Base64 Data URL so the user's deposit is NEVER rejected or lost.
            if (!uploadSuccess || !proofPath) {
                console.warn("Using Data URI fallback for payment receipt proof.");
                proofPath = `data:${mimeType};base64,${buffer.toString('base64')}`;
            }
        } else {
            try {
                const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
                await fs.mkdir(uploadDir, { recursive: true });
                const filepath = path.join(uploadDir, filename);
                await fs.writeFile(filepath, buffer);
                proofPath = `/uploads/proofs/${filename}`;
            } catch (fsErr) {
                console.warn("Filesystem write error, using Data URI fallback:", fsErr.message);
                proofPath = `data:${mimeType};base64,${buffer.toString('base64')}`;
            }
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

        return NextResponse.json({
            message: "Deposit submitted successfully. Verification pending admin approval.",
            deposit
        }, { status: 201 });

    } catch (error) {
        console.error("Deposit request API error:", error);
        return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
    }
}

