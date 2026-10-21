const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        try {
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(process.cwd(), 'bank.db');
            dbInstance = new sqlite3.Database(dbPath);
            dbInstance.serialize(() => {
                dbInstance.run("PRAGMA journal_mode=WAL;");
                dbInstance.run("PRAGMA foreign_keys=ON;");
            });
        } catch (err) {
            console.warn("[SQLite] sqlite3 native module failed to load:", err.message);
            throw new Error("SQLite is not supported in this serverless environment. Please configure SUPABASE_URL or MYSQL_HOST.");
        }
    }
    return dbInstance;
}

// Helper functions wrapping sqlite3 in Promises
const sqlite = {
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                getDb().run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                getDb().get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            try {
                getDb().all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    exec(sql) {
        return new Promise((resolve, reject) => {
            try {
                getDb().exec(sql, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    async transaction(callback) {
        await this.exec('BEGIN IMMEDIATE TRANSACTION');
        try {
            const result = await callback(this);
            await this.exec('COMMIT');
            return result;
        } catch (error) {
            await this.exec('ROLLBACK');
            throw error;
        }
    }
};

// Initialize schema and seed database
async function initDatabase() {
    // 1. Create tables
    await sqlite.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            account_number TEXT UNIQUE NOT NULL,
            routing_number TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            role TEXT DEFAULT 'user',
            must_change_password INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_wallets (
            user_id TEXT PRIMARY KEY,
            usd_balance REAL DEFAULT 0.00 NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS coins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            symbol TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS crypto_wallets (
            user_id TEXT,
            coin_id INTEGER,
            balance REAL DEFAULT 0.00 NOT NULL,
            PRIMARY KEY(user_id, coin_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(coin_id) REFERENCES coins(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS deposit_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coin_id INTEGER,
            wallet_address TEXT NOT NULL,
            deposit_amount REAL NOT NULL,
            usd_credit REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(coin_id) REFERENCES coins(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            method_id INTEGER,
            proof TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(method_id) REFERENCES deposit_methods(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id TEXT,
            receiver_id TEXT,
            amount REAL NOT NULL,
            usdt_fee REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            bank_name TEXT NOT NULL,
            account_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            amount REAL NOT NULL,
            fee REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            type TEXT NOT NULL,
            amount TEXT NOT NULL,
            status TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            sender_role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    try {
        db.exec(`ALTER TABLE notifications ADD COLUMN sender_role TEXT DEFAULT 'admin'`);
    } catch (e) {
        // Column already exists
    }

    // 2. Seed Default Coins
    const defaultCoins = [
        { name: 'Tether', symbol: 'USDT' },
        { name: 'Bitcoin', symbol: 'BTC' },
        { name: 'Ethereum', symbol: 'ETH' },
        { name: 'Binance Coin', symbol: 'BNB' }
    ];
    for (const coin of defaultCoins) {
        await sqlite.run(`INSERT OR IGNORE INTO coins (name, symbol) VALUES (?, ?)`, [coin.name, coin.symbol]);
    }

    // 3. Seed Default Settings
    const defaultSettings = [
        { key: 'transfer_fee_ratio_usd', value: '5000' },
        { key: 'transfer_fee_ratio_usdt', value: '1' },
        { key: 'withdrawal_fee_usdt', value: '5' },
        { key: 'network_fee_usdt', value: '5' },
        { key: 'smtp_host', value: 'smtp.gmail.com' },
        { key: 'smtp_port', value: '587' },
        { key: 'smtp_secure', value: '0' },
        { key: 'smtp_user', value: 'clintondye6@gmail.com' },
        { key: 'smtp_pass', value: 'ljhqowfjfusseevo' },
        { key: 'smtp_from', value: 'clintondye6@gmail.com' },
        { key: 'smtp_from_name', value: 'PND Bank Alerts' },
        { key: 'smtp_enabled', value: '1' }
    ];
    for (const setting of defaultSettings) {
        await sqlite.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [setting.key, setting.value]);
    }

    // 4. Seed Default Admin User
    const adminEmail = 'admin@gmail.com';
    const hashedPassword = await bcrypt.hash('12345678', 10);
    const adminId = '00000000-0000-0000-0000-000000000000';
    
    await sqlite.run(`
        INSERT OR IGNORE INTO users (id, name, email, password, account_number, routing_number, status, role, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [adminId, 'System Admin', adminEmail, hashedPassword, '9999999999', '000000000', 'active', 'admin', 1]);

    await sqlite.run(`
        INSERT OR IGNORE INTO bank_wallets (user_id, usd_balance)
        VALUES (?, ?)
    `, [adminId, 0.00]);
}

// Perform initialization on load ONLY if SQLite is the active mode and NOT on Vercel / serverless
if (
    !process.env.VERCEL &&
    process.env.NODE_ENV !== 'production' &&
    !process.env.SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.MYSQL_HOST
) {
    initDatabase().catch(err => {
        console.warn("Local SQLite database initialization skipped or failed:", err.message);
    });
}

module.exports = sqlite;
