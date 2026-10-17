const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.SUPABASE_SERVICE_KEY || 
                           process.env.SUPABASE_SECRET_KEY || 
                           process.env.SUPABASE_KEY || 
                           process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                           process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    });

    // Helper to ensure 'proof' and 'proofs' storage buckets exist with public access
    supabase.ensureProofBucket = async function() {
        if (!supabase || !supabase.storage) return 'proof';
        const candidateBuckets = ['proof', 'proofs'];
        
        for (const bucket of candidateBuckets) {
            try {
                const { data: b, error } = await supabase.storage.getBucket(bucket);
                if (b && !error) {
                    if (!b.public) {
                        await supabase.storage.updateBucket(bucket, { public: true }).catch(() => {});
                    }
                    return bucket;
                }
            } catch (_) {}
        }

        // Try creating 'proof' first
        try {
            const { error: cErr1 } = await supabase.storage.createBucket('proof', {
                public: true,
                fileSizeLimit: 10485760
            });
            if (!cErr1) return 'proof';
        } catch (_) {}

        // Try creating 'proofs' as fallback
        try {
            const { error: cErr2 } = await supabase.storage.createBucket('proofs', {
                public: true,
                fileSizeLimit: 10485760
            });
            if (!cErr2) return 'proofs';
        } catch (_) {}

        return 'proof';
    };
}

module.exports = supabase;

