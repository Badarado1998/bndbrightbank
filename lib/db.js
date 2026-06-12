const supabase = require('./supabase');
const mysql = require('./mysql');
const crypto = require('crypto');

const isSupabase = !!supabase;
const isMySQL = !!mysql;

// Helper to determine if we are running in a specific database mode
function getMode() {
    if (isMySQL) return 'mysql';
    if (isSupabase) return 'supabase';
    return 'sqlite';
}

console.log(`[Database] Initialized in ${getMode().toUpperCase()} mode.`);

// Lazy-load SQLite only when actually needed (not available on Vercel/serverless)
let _sqliteHelper = null;
function getSqlite() {
    if (!_sqliteHelper) {
        _sqliteHelper = require('./sqlite');
    }
    return _sqliteHelper;
}
// Lazy-load active database engine for local files
function getLocalEngine() {
    if (isMySQL) return mysql;
    return getSqlite();
}
// Active database engine for local files resolved dynamically
const sqlite = {
    get(sql, params = []) {
        if (isSupabase) return null;
        return getLocalEngine().get(sql, params);
    },
    all(sql, params = []) {
        if (isSupabase) return null;
        return getLocalEngine().all(sql, params);
    },
    run(sql, params = []) {
        if (isSupabase) return null;
        return getLocalEngine().run(sql, params);
    },
    transaction(callback) {
        if (isSupabase) return null;
        return getLocalEngine().transaction(callback);
    }
};


// Database-agnostic upsert helper functions to unify SQLite and MySQL syntax
async function upsertUsdBalance(tx, userId, creditAmount) {
    const row = await tx.get(`SELECT usd_balance FROM bank_wallets WHERE user_id = ?`, [userId]);
    if (row) {
        await tx.run(`UPDATE bank_wallets SET usd_balance = usd_balance + ? WHERE user_id = ?`, [creditAmount, userId]);
    } else {
        await tx.run(`INSERT INTO bank_wallets (user_id, usd_balance) VALUES (?, ?)`, [userId, creditAmount]);
    }
}

async function upsertCryptoBalance(tx, userId, coinId, creditAmount) {
    const row = await tx.get(`SELECT balance FROM crypto_wallets WHERE user_id = ? AND coin_id = ?`, [userId, coinId]);
    if (row) {
        await tx.run(`UPDATE crypto_wallets SET balance = balance + ? WHERE user_id = ? AND coin_id = ?`, [creditAmount, userId, coinId]);
    } else {
        await tx.run(`INSERT INTO crypto_wallets (user_id, coin_id, balance) VALUES (?, ?, ?)`, [userId, coinId, creditAmount]);
    }
}

const db = {
    getMode,

    // --- USERS ---
    async getUserByEmail(email) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            return await sqlite.get(`SELECT * FROM users WHERE email = ?`, [email]);
        }
    },

    async getUserById(id) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            return await sqlite.get(`SELECT * FROM users WHERE id = ?`, [id]);
        }
    },

    async getUserByAccountNumber(accountNumber) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('account_number', accountNumber)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            return await sqlite.get(`SELECT * FROM users WHERE account_number = ?`, [accountNumber]);
        }
    },

    async createUser({ name, email, password, account_number, routing_number, role = 'user' }) {
        const userId = crypto.randomUUID();
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .insert([{ id: userId, name, email, password, account_number, routing_number, role }])
                .select()
                .single();
            if (error) throw error;
            
            // Create bank wallet
            const { error: walletError } = await supabase
                .from('bank_wallets')
                .insert([{ user_id: userId, usd_balance: 0.00 }]);
            if (walletError) throw walletError;

            return data;
        } else {
            await sqlite.run(`
                INSERT INTO users (id, name, email, password, account_number, routing_number, role)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, name, email, password, account_number, routing_number, role]);
            
            await sqlite.run(`
                INSERT INTO bank_wallets (user_id, usd_balance)
                VALUES (?, ?)
            `, [userId, 0.00]);

            return await this.getUserById(userId);
        }
    },

    async updateUserPassword(userId, hashedPassword, mustChangePassword = 0) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({ password: hashedPassword, must_change_password: mustChangePassword })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            await sqlite.run(`
                UPDATE users SET password = ?, must_change_password = ? WHERE id = ?
            `, [hashedPassword, mustChangePassword, userId]);
            return await this.getUserById(userId);
        }
    },

    async updateUserStatus(userId, status) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({ status })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            await sqlite.run(`UPDATE users SET status = ? WHERE id = ?`, [status, userId]);
            return await this.getUserById(userId);
        }
    },

    async deleteUser(userId) {
        if (isSupabase) {
            const { error } = await supabase.from('users').delete().eq('id', userId);
            if (error) throw error;
            return true;
        } else {
            await sqlite.run(`DELETE FROM users WHERE id = ?`, [userId]);
            return true;
        }
    },

    async getUsers() {
        if (isSupabase) {
            // Fetch users with their usd balances and crypto wallets
            const { data: users, error: usersErr } = await supabase.from('users').select('*').order('created_at', { ascending: false });
            if (usersErr) throw usersErr;

            const { data: wallets, error: walletsErr } = await supabase.from('bank_wallets').select('*');
            if (walletsErr) throw walletsErr;

            const { data: cryptos, error: cryptosErr } = await supabase.from('crypto_wallets').select('*, coins(symbol)');
            if (cryptosErr) throw cryptosErr;

            return users.map(user => {
                const wallet = wallets.find(w => w.user_id === user.id);
                const userCryptos = cryptos.filter(c => c.user_id === user.id);
                const cryptoBalances = {};
                userCryptos.forEach(c => {
                    cryptoBalances[c.coins.symbol] = c.balance;
                });
                return {
                    ...user,
                    usd_balance: wallet ? wallet.usd_balance : 0,
                    cryptoBalances
                };
            });
        } else {
            const users = await sqlite.all(`SELECT * FROM users ORDER BY created_at DESC`);
            const wallets = await sqlite.all(`SELECT * FROM bank_wallets`);
            const cryptos = await sqlite.all(`
                SELECT cw.*, c.symbol 
                FROM crypto_wallets cw 
                JOIN coins c ON cw.coin_id = c.id
            `);

            return users.map(user => {
                const wallet = wallets.find(w => w.user_id === user.id);
                const userCryptos = cryptos.filter(c => c.user_id === user.id);
                const cryptoBalances = {};
                userCryptos.forEach(c => {
                    cryptoBalances[c.symbol] = c.balance;
                });
                return {
                    ...user,
                    usd_balance: wallet ? wallet.usd_balance : 0,
                    cryptoBalances
                };
            });
        }
    },

    // --- COINS ---
    async getCoins() {
        if (isSupabase) {
            const { data, error } = await supabase.from('coins').select('*').order('id', { ascending: true });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`SELECT * FROM coins ORDER BY id ASC`);
        }
    },

    async getActiveCoins() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposit_methods')
                .select('coin_id, coins(*)')
                .order('coin_id', { ascending: true });
            if (error) throw error;
            const uniqueCoinsMap = {};
            data.forEach(item => {
                if (item.coins) {
                    uniqueCoinsMap[item.coins.id] = item.coins;
                }
            });
            return Object.values(uniqueCoinsMap);
        } else {
            return await sqlite.all(`
                SELECT DISTINCT c.* 
                FROM coins c 
                JOIN deposit_methods dm ON dm.coin_id = c.id 
                ORDER BY c.id ASC
            `);
        }
    },

    async getCoinBySymbol(symbol) {
        if (isSupabase) {
            const { data, error } = await supabase.from('coins').select('*').eq('symbol', symbol.toUpperCase()).maybeSingle();
            if (error) throw error;
            return data;
        } else {
            return await sqlite.get(`SELECT * FROM coins WHERE symbol = ?`, [symbol.toUpperCase()]);
        }
    },

    async createCoin(name, symbol) {
        if (isSupabase) {
            const { data, error } = await supabase.from('coins').insert([{ name, symbol: symbol.toUpperCase() }]).select().single();
            if (error) throw error;
            return data;
        } else {
            const result = await sqlite.run(`INSERT INTO coins (name, symbol) VALUES (?, ?)`, [name, symbol.toUpperCase()]);
            return { id: result.id, name, symbol: symbol.toUpperCase() };
        }
    },

    // --- WALLETS ---
    async getBalances(userId) {
        if (isSupabase) {
            const { data: bank, error: bankErr } = await supabase.from('bank_wallets').select('usd_balance').eq('user_id', userId).maybeSingle();
            if (bankErr) throw bankErr;

            const { data: cryptos, error: cryptosErr } = await supabase
                .from('crypto_wallets')
                .select('balance, coin_id, coins(symbol, name)')
                .eq('user_id', userId);
            if (cryptosErr) throw cryptosErr;

            const cryptoBalances = {};
            cryptos.forEach(c => {
                cryptoBalances[c.coins.symbol] = {
                    balance: c.balance,
                    name: c.coins.name,
                    coin_id: c.coin_id
                };
            });

            return {
                usd_balance: bank ? bank.usd_balance : 0,
                crypto: cryptoBalances
            };
        } else {
            const bank = await sqlite.get(`SELECT usd_balance FROM bank_wallets WHERE user_id = ?`, [userId]);
            const cryptos = await sqlite.all(`
                SELECT cw.balance, cw.coin_id, c.symbol, c.name 
                FROM crypto_wallets cw 
                JOIN coins c ON cw.coin_id = c.id
                WHERE cw.user_id = ?
            `, [userId]);

            const cryptoBalances = {};
            cryptos.forEach(c => {
                cryptoBalances[c.symbol] = {
                    balance: c.balance,
                    name: c.name,
                    coin_id: c.coin_id
                };
            });

            return {
                usd_balance: bank ? bank.usd_balance : 0,
                crypto: cryptoBalances
            };
        }
    },

    // --- SETTINGS ---
    async getSettings() {
        if (isSupabase) {
            const { data, error } = await supabase.from('settings').select('*');
            if (error) throw error;
            const settingsMap = {};
            data.forEach(s => settingsMap[s.key] = s.value);
            return settingsMap;
        } else {
            const rows = await sqlite.all(`SELECT * FROM settings`);
            const settingsMap = {};
            rows.forEach(s => settingsMap[s.key] = s.value);
            return settingsMap;
        }
    },

    async updateSettings(settingsMap) {
        if (isSupabase) {
            for (const [key, value] of Object.entries(settingsMap)) {
                const { error } = await supabase.from('settings').upsert({ key, value });
                if (error) throw error;
            }
        } else {
            for (const [key, value] of Object.entries(settingsMap)) {
                await sqlite.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)]);
            }
        }
    },

    // --- DEPOSIT METHODS ---
    async getDepositMethods() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposit_methods')
                .select('*, coins(name, symbol)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT dm.*, c.name as coin_name, c.symbol as coin_symbol 
                FROM deposit_methods dm
                JOIN coins c ON dm.coin_id = c.id
                ORDER BY dm.created_at DESC
            `);
        }
    },

    async getDepositMethodById(id) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposit_methods')
                .select('*, coins(name, symbol)')
                .eq('id', id)
                .maybeSingle();
            if (error) throw error;
            return data;
        } else {
            return await sqlite.get(`
                SELECT dm.*, c.name as coin_name, c.symbol as coin_symbol 
                FROM deposit_methods dm
                JOIN coins c ON dm.coin_id = c.id
                WHERE dm.id = ?
            `, [id]);
        }
    },

    async createDepositMethod({ coin_id, wallet_address, deposit_amount, usd_credit }) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposit_methods')
                .insert([{ coin_id, wallet_address, deposit_amount, usd_credit }])
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const result = await sqlite.run(`
                INSERT INTO deposit_methods (coin_id, wallet_address, deposit_amount, usd_credit)
                VALUES (?, ?, ?, ?)
            `, [coin_id, wallet_address, deposit_amount, usd_credit]);
            return await this.getDepositMethodById(result.id);
        }
    },

    async updateDepositMethod(id, { coin_id, wallet_address, deposit_amount, usd_credit }) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposit_methods')
                .update({ coin_id, wallet_address, deposit_amount, usd_credit })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            await sqlite.run(`
                UPDATE deposit_methods 
                SET coin_id = ?, wallet_address = ?, deposit_amount = ?, usd_credit = ?
                WHERE id = ?
            `, [coin_id, wallet_address, deposit_amount, usd_credit, id]);
            return await this.getDepositMethodById(id);
        }
    },

    async deleteDepositMethod(id) {
        if (isSupabase) {
            const { error } = await supabase.from('deposit_methods').delete().eq('id', id);
            if (error) throw error;
            return true;
        } else {
            await sqlite.run(`DELETE FROM deposit_methods WHERE id = ?`, [id]);
            return true;
        }
    },

    // --- DEPOSITS ---
    async getDeposits() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposits')
                .select('*, users(name, email), deposit_methods(*, coins(*))')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT d.*, u.name as user_name, u.email as user_email, 
                       dm.wallet_address, dm.deposit_amount, dm.usd_credit, c.symbol as coin_symbol
                FROM deposits d
                JOIN users u ON d.user_id = u.id
                JOIN deposit_methods dm ON d.method_id = dm.id
                JOIN coins c ON dm.coin_id = c.id
                ORDER BY d.created_at DESC
            `);
        }
    },

    async getUserDeposits(userId) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('deposits')
                .select('*, deposit_methods(*, coins(*))')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT d.*, dm.wallet_address, dm.deposit_amount, dm.usd_credit, c.symbol as coin_symbol
                FROM deposits d
                JOIN deposit_methods dm ON d.method_id = dm.id
                JOIN coins c ON dm.coin_id = c.id
                WHERE d.user_id = ?
                ORDER BY d.created_at DESC
            `, [userId]);
        }
    },

    async createDepositRequest({ user_id, method_id, proof }) {
        if (isSupabase) {
            const method = await this.getDepositMethodById(method_id);
            const { data, error } = await supabase
                .from('deposits')
                .insert([{ user_id, method_id, proof, status: 'pending' }])
                .select()
                .single();
            if (error) throw error;

            // Also create a pending transaction record
            const coinSymbol = method.coin_symbol || (method.coins && method.coins.symbol) || 'USDT';
            const amtStr = `+${method.usd_credit} USD / +${method.deposit_amount} ${coinSymbol}`;
            await supabase.from('transactions').insert([{
                user_id,
                type: 'deposit',
                amount: amtStr,
                status: 'pending',
                description: `Deposit via ${coinSymbol} address ${method.wallet_address}`
            }]);

            return data;
        } else {
            const result = await sqlite.run(`
                INSERT INTO deposits (user_id, method_id, proof, status)
                VALUES (?, ?, ?, 'pending')
            `, [user_id, method_id, proof]);

            const method = await this.getDepositMethodById(method_id);
            const amtStr = `+${method.usd_credit} USD / +${method.deposit_amount} ${method.coin_symbol}`;
            await sqlite.run(`
                INSERT INTO transactions (user_id, type, amount, status, description)
                VALUES (?, 'deposit', ?, 'pending', ?)
            `, [user_id, amtStr, `Deposit via ${method.coin_symbol} address ${method.wallet_address}`]);

            return { id: result.id, user_id, method_id, proof, status: 'pending' };
        }
    },

    async approveDeposit(depositId) {
        if (isSupabase) {
            // Using RPC for Supabase transaction handling
            const { data, error } = await supabase.rpc('approve_deposit_rpc', { p_deposit_id: depositId });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.transaction(async (tx) => {
                const deposit = await tx.get(`SELECT * FROM deposits WHERE id = ?`, [depositId]);
                if (!deposit) throw new Error("Deposit not found");
                if (deposit.status !== 'pending') throw new Error("Deposit already processed");

                const method = await tx.get(`SELECT * FROM deposit_methods WHERE id = ?`, [deposit.method_id]);
                if (!method) throw new Error("Deposit method not found");

                // Update deposit status
                await tx.run(`UPDATE deposits SET status = 'approved' WHERE id = ?`, [depositId]);

                // Update USD balance
                await upsertUsdBalance(tx, deposit.user_id, method.usd_credit);

                // Update Crypto balance
                await upsertCryptoBalance(tx, deposit.user_id, method.coin_id, method.deposit_amount);

                // Update transaction status
                const coin = await tx.get(`SELECT symbol FROM coins WHERE id = ?`, [method.coin_id]);
                const amtStr = `+${method.usd_credit} USD / +${method.deposit_amount} ${coin.symbol}`;
                await tx.run(`
                    UPDATE transactions 
                    SET status = 'approved' 
                    WHERE user_id = ? AND type = 'deposit' AND amount = ? AND status = 'pending'
                `, [deposit.user_id, amtStr]);

                return true;
            });
        }
    },

    async rejectDeposit(depositId) {
        if (isSupabase) {
            const { data: deposit, error: depErr } = await supabase.from('deposits').select('*, deposit_methods(*, coins(symbol))').eq('id', depositId).single();
            if (depErr) throw depErr;
            if (deposit.status !== 'pending') throw new Error("Deposit already processed");

            await supabase.from('deposits').update({ status: 'rejected' }).eq('id', depositId);

            const amtStr = `+${deposit.deposit_methods.usd_credit} USD / +${deposit.deposit_methods.deposit_amount} ${deposit.deposit_methods.coins.symbol}`;
            await supabase.from('transactions')
                .update({ status: 'rejected' })
                .eq('user_id', deposit.user_id)
                .eq('type', 'deposit')
                .eq('amount', amtStr)
                .eq('status', 'pending');

            return true;
        } else {
            return await sqlite.transaction(async (tx) => {
                const deposit = await tx.get(`SELECT * FROM deposits WHERE id = ?`, [depositId]);
                if (!deposit) throw new Error("Deposit not found");
                if (deposit.status !== 'pending') throw new Error("Deposit already processed");

                await tx.run(`UPDATE deposits SET status = 'rejected' WHERE id = ?`, [depositId]);

                const method = await tx.get(`SELECT * FROM deposit_methods WHERE id = ?`, [deposit.method_id]);
                const coin = await tx.get(`SELECT symbol FROM coins WHERE id = ?`, [method.coin_id]);
                const amtStr = `+${method.usd_credit} USD / +${method.deposit_amount} ${coin.symbol}`;

                await tx.run(`
                    UPDATE transactions 
                    SET status = 'rejected' 
                    WHERE user_id = ? AND type = 'deposit' AND amount = ? AND status = 'pending'
                `, [deposit.user_id, amtStr]);

                return true;
            });
        }
    },

    // --- TRANSFERS ---
    async getTransfers() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('transfers')
                .select('*, sender:users!transfers_sender_id_fkey(name, email, account_number), receiver:users!transfers_receiver_id_fkey(name, email, account_number)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT t.*, 
                       s.name as sender_name, s.email as sender_email, s.account_number as sender_account,
                       r.name as receiver_name, r.email as receiver_email, r.account_number as receiver_account
                FROM transfers t
                JOIN users s ON t.sender_id = s.id
                JOIN users r ON t.receiver_id = r.id
                ORDER BY t.created_at DESC
            `);
        }
    },

    async getUserTransfers(userId) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('transfers')
                .select('*, sender:users!transfers_sender_id_fkey(name, account_number), receiver:users!transfers_receiver_id_fkey(name, account_number)')
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT t.*, 
                       s.name as sender_name, s.account_number as sender_account,
                       r.name as receiver_name, r.account_number as receiver_account
                FROM transfers t
                JOIN users s ON t.sender_id = s.id
                JOIN users r ON t.receiver_id = r.id
                WHERE t.sender_id = ? OR t.receiver_id = ?
                ORDER BY t.created_at DESC
            `, [userId, userId]);
        }
    },

    async executeTransfer({ sender_id, receiver_id, amount, usdt_fee }) {
        if (sender_id === receiver_id) throw new Error("Cannot transfer to yourself");

        if (isSupabase) {
            const { data, error } = await supabase.rpc('execute_transfer_rpc', {
                p_sender_id: sender_id,
                p_receiver_id: receiver_id,
                p_amount: amount,
                p_fee: usdt_fee
            });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.transaction(async (tx) => {
                // 1. Verify sender balances
                const senderWallet = await tx.get(`SELECT usd_balance FROM bank_wallets WHERE user_id = ?`, [sender_id]);
                if (!senderWallet || senderWallet.usd_balance < amount) {
                    throw new Error("Insufficient USD bank balance.");
                }

                // Get USDT coin ID
                const usdtCoin = await tx.get(`SELECT id FROM coins WHERE symbol = 'USDT'`);
                if (!usdtCoin) throw new Error("USDT coin not found");

                const senderCrypto = await tx.get(`SELECT balance FROM crypto_wallets WHERE user_id = ? AND coin_id = ?`, [sender_id, usdtCoin.id]);
                const usdtBalance = senderCrypto ? senderCrypto.balance : 0;
                if (usdt_fee > 0 && usdtBalance < usdt_fee) {
                    throw new Error("Insufficient USDT balance for transfer fee.");
                }

                // 2. Perform Deductions and Additions
                // Deduct USD from Sender
                await tx.run(`UPDATE bank_wallets SET usd_balance = usd_balance - ? WHERE user_id = ?`, [amount, sender_id]);

                // Deduct USDT fee from Sender (if any)
                if (usdt_fee > 0) {
                    await tx.run(`UPDATE crypto_wallets SET balance = balance - ? WHERE user_id = ? AND coin_id = ?`, [usdt_fee, sender_id, usdtCoin.id]);
                }

                // Credit USD to Receiver
                await upsertUsdBalance(tx, receiver_id, amount);

                // 3. Create Transfer record
                await tx.run(`
                    INSERT INTO transfers (sender_id, receiver_id, amount, usdt_fee)
                    VALUES (?, ?, ?, ?)
                `, [sender_id, receiver_id, amount, usdt_fee]);

                // 4. Create Transaction history records
                // Sender Transactions
                await tx.run(`
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'transfer_sent', ?, 'completed', ?)
                `, [sender_id, `-$${amount} USD`, `Transfer to Account ${receiver_id}`]);

                if (usdt_fee > 0) {
                    await tx.run(`
                        INSERT INTO transactions (user_id, type, amount, status, description)
                        VALUES (?, 'transfer_sent', ?, 'completed', ?)
                    `, [sender_id, `-${usdt_fee} USDT`, `Transfer fee for sending $${amount} USD`]);
                }

                // Receiver Transaction
                await tx.run(`
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'transfer_received', ?, 'completed', ?)
                `, [receiver_id, `+$${amount} USD`, `Transfer from Account ${sender_id}`]);

                return true;
            });
        }
    },

    // --- WITHDRAWALS ---
    async getWithdrawals() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('withdrawals')
                .select('*, users(name, email, account_number)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT w.*, u.name as user_name, u.email as user_email, u.account_number as user_account
                FROM withdrawals w
                JOIN users u ON w.user_id = u.id
                ORDER BY w.created_at DESC
            `);
        }
    },

    async getUserWithdrawals(userId) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('withdrawals')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC
            `, [userId]);
        }
    },

    async executeWithdrawalRequest({ user_id, bank_name, account_name, account_number, amount, fee }) {
        if (isSupabase) {
            const { data, error } = await supabase.rpc('execute_withdrawal_rpc', {
                p_user_id: user_id,
                p_bank_name: bank_name,
                p_account_name: account_name,
                p_account_number: account_number,
                p_amount: amount,
                p_fee: fee
            });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.transaction(async (tx) => {
                // Verify user has sufficient USD bank balance
                const wallet = await tx.get(`SELECT usd_balance FROM bank_wallets WHERE user_id = ?`, [user_id]);
                if (!wallet || wallet.usd_balance < amount) {
                    throw new Error("Insufficient USD bank balance.");
                }

                // Verify user has USDT to pay the network fee
                const usdtCoin = await tx.get(`SELECT id FROM coins WHERE symbol = 'USDT'`);
                if (!usdtCoin) throw new Error("USDT coin not found");

                const cryptoWallet = await tx.get(`SELECT balance FROM crypto_wallets WHERE user_id = ? AND coin_id = ?`, [user_id, usdtCoin.id]);
                const usdtBalance = cryptoWallet ? cryptoWallet.balance : 0;
                
                if (usdtBalance <= 0) {
                    throw new Error("Network fee payment required. Please maintain sufficient USDT balance before withdrawal.");
                }
                if (usdtBalance < fee) {
                    throw new Error(`Insufficient USDT balance for network fee of ${fee} USDT.`);
                }

                // Deduct USD from bank balance (Hold/Deduct it immediately for the pending withdrawal request)
                await tx.run(`UPDATE bank_wallets SET usd_balance = usd_balance - ? WHERE user_id = ?`, [amount, user_id]);

                // Deduct USDT network fee
                await tx.run(`UPDATE crypto_wallets SET balance = balance - ? WHERE user_id = ? AND coin_id = ?`, [fee, user_id, usdtCoin.id]);

                // Create withdrawal request
                const result = await tx.run(`
                    INSERT INTO withdrawals (user_id, bank_name, account_name, account_number, amount, fee, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')
                `, [user_id, bank_name, account_name, account_number, amount, fee]);

                // Create pending transaction history records
                await tx.run(`
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'withdrawal', ?, 'pending', ?)
                `, [user_id, `-$${amount} USD`, `Withdrawal request to ${bank_name} (${account_number})`]);

                await tx.run(`
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'withdrawal', ?, 'completed', ?)
                `, [user_id, `-${fee} USDT`, `Withdrawal network fee`]);

                return { id: result.id };
            });
        }
    },

    async approveWithdrawal(withdrawalId) {
        if (isSupabase) {
            const { data, error } = await supabase.rpc('approve_withdrawal_rpc', { p_withdrawal_id: withdrawalId });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.transaction(async (tx) => {
                const w = await tx.get(`SELECT * FROM withdrawals WHERE id = ?`, [withdrawalId]);
                if (!w) throw new Error("Withdrawal request not found");
                if (w.status !== 'pending') throw new Error("Withdrawal already processed");

                // Update status
                await tx.run(`UPDATE withdrawals SET status = 'approved' WHERE id = ?`, [withdrawalId]);

                // Update transaction record status
                const amtStr = `-$${w.amount} USD`;
                await tx.run(`
                    UPDATE transactions 
                    SET status = 'approved' 
                    WHERE user_id = ? AND type = 'withdrawal' AND amount = ? AND status = 'pending'
                `, [w.user_id, amtStr]);

                return true;
            });
        }
    },

    async rejectWithdrawal(withdrawalId) {
        if (isSupabase) {
            const { data: w, error: wErr } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
            if (wErr) throw wErr;
            if (w.status !== 'pending') throw new Error("Withdrawal already processed");

            // Return USD to bank balance
            await supabase.rpc('reject_withdrawal_rpc', { p_withdrawal_id: withdrawalId });
            return true;
        } else {
            return await sqlite.transaction(async (tx) => {
                const w = await tx.get(`SELECT * FROM withdrawals WHERE id = ?`, [withdrawalId]);
                if (!w) throw new Error("Withdrawal request not found");
                if (w.status !== 'pending') throw new Error("Withdrawal already processed");

                // Mark rejected
                await tx.run(`UPDATE withdrawals SET status = 'rejected' WHERE id = ?`, [withdrawalId]);

                // Refund USD back to user balance (the USDT network fee is non-refundable as it was processed)
                await tx.run(`UPDATE bank_wallets SET usd_balance = usd_balance + ? WHERE user_id = ?`, [w.amount, w.user_id]);

                // Update transaction status
                const amtStr = `-$${w.amount} USD`;
                await tx.run(`
                    UPDATE transactions 
                    SET status = 'rejected' 
                    WHERE user_id = ? AND type = 'withdrawal' AND amount = ? AND status = 'pending'
                `, [w.user_id, amtStr]);

                // Add a transaction record for refund
                await tx.run(`
                    INSERT INTO transactions (user_id, type, amount, status, description)
                    VALUES (?, 'deposit', ?, 'completed', ?)
                `, [w.user_id, `+$${w.amount} USD`, `Refund for rejected withdrawal request #${withdrawalId}`]);

                return true;
            });
        }
    },

    // --- TRANSACTIONS ---
    async getTransactions(userId) {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
        }
    },

    // --- AUDIT LOGS ---
    async getAuditLogs() {
        if (isSupabase) {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*, users(name, email)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } else {
            return await sqlite.all(`
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.id
                ORDER BY al.created_at DESC
            `);
        }
    },

    async createAuditLog({ user_id, action, details, ip_address = '' }) {
        if (isSupabase) {
            const { error } = await supabase
                .from('audit_logs')
                .insert([{ user_id, action, details: String(details), ip_address }]);
            if (error) {
                console.error("Supabase audit log error:", error);
            }
        } else {
            await sqlite.run(`
                INSERT INTO audit_logs (user_id, action, details, ip_address)
                VALUES (?, ?, ?, ?)
            `, [user_id, action, String(details), ip_address]);
        }
    },

    async adjustUserBalances(userId, usdBalance, cryptoBalances) {
        if (isSupabase) {
            const { error: usdErr } = await supabase
                .from('bank_wallets')
                .upsert({ user_id: userId, usd_balance: usdBalance });
            if (usdErr) throw usdErr;

            for (const [symbol, balance] of Object.entries(cryptoBalances)) {
                const coin = await this.getCoinBySymbol(symbol);
                if (coin) {
                    const { error: cryptoErr } = await supabase
                        .from('crypto_wallets')
                        .upsert({ user_id: userId, coin_id: coin.id, balance }, { onConflict: 'user_id,coin_id' });
                    if (cryptoErr) throw cryptoErr;
                }
            }
        } else {
            await sqlite.transaction(async (tx) => {
                // Upsert USD Bank Wallet
                const wallet = await tx.get(`SELECT user_id FROM bank_wallets WHERE user_id = ?`, [userId]);
                if (wallet) {
                    await tx.run(`UPDATE bank_wallets SET usd_balance = ? WHERE user_id = ?`, [usdBalance, userId]);
                } else {
                    await tx.run(`INSERT INTO bank_wallets (user_id, usd_balance) VALUES (?, ?)`, [userId, usdBalance]);
                }

                // Upsert Crypto Wallets
                for (const [symbol, balance] of Object.entries(cryptoBalances)) {
                    const coin = await tx.get(`SELECT id FROM coins WHERE symbol = ?`, [symbol]);
                    if (coin) {
                        const cw = await tx.get(`SELECT user_id FROM crypto_wallets WHERE user_id = ? AND coin_id = ?`, [userId, coin.id]);
                        if (cw) {
                            await tx.run(`UPDATE crypto_wallets SET balance = ? WHERE user_id = ? AND coin_id = ?`, [balance, userId, coin.id]);
                        } else {
                            await tx.run(`INSERT INTO crypto_wallets (user_id, coin_id, balance) VALUES (?, ?, ?)`, [userId, coin.id, balance]);
                        }
                    }
                }
            });
        }
    }
};

module.exports = db;
