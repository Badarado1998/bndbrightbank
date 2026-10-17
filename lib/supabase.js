const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });
}

/**
 * Ensures that a public bucket exists for storing payment proofs.
 * Checks for either 'proofs' or 'proof', and creates it with public access if missing.
 * @param {any} client
 * @returns {Promise<string>} The active bucket name ('proofs' or 'proof')
 */
async function ensureProofBucket(client = supabase) {
    if (!client || !client.storage) return 'proofs';
    const targetBuckets = ['proofs', 'proof'];

    try {
        const { data: buckets, error: listError } = await client.storage.listBuckets();
        if (!listError && Array.isArray(buckets)) {
            for (const name of targetBuckets) {
                const found = buckets.find(b => b.name === name || b.id === name);
                if (found) {
                    if (!found.public) {
                        try {
                            await client.storage.updateBucket(found.id || name, { public: true });
                        } catch (e) {
                            console.warn(`[Supabase Storage] Notice: could not update bucket ${name} to public:`, e.message);
                        }
                    }
                    return found.id || name;
                }
            }
        }
    } catch (err) {
        console.warn("[Supabase Storage] List buckets error:", err.message);
    }

    // Try creating both buckets with public access if neither exists
    for (const name of targetBuckets) {
        try {
            const { error: createError } = await client.storage.createBucket(name, {
                public: true,
                fileSizeLimit: 52428800 // 50MB
            });
            if (!createError) {
                console.log(`[Supabase Storage] Successfully created public bucket '${name}'`);
                return name;
            }
        } catch (e) {
            console.warn(`[Supabase Storage] Error creating bucket '${name}':`, e.message);
        }
    }

    return 'proofs';
}

if (supabase) {
    supabase.ensureProofBucket = ensureProofBucket;
    // Asynchronously ensure public proof bucket exists on startup
    ensureProofBucket(supabase).catch(err => {
        console.warn("[Supabase Storage] Background bucket initialization notice:", err?.message || err);
    });
}

module.exports = supabase;
if (supabase) {
    module.exports.ensureProofBucket = ensureProofBucket;
}

