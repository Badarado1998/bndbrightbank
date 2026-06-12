-- HOSTINGER MYSQL DATABASE SCHEMA
-- paste this script in the Hostinger phpMyAdmin SQL tab to set up your tables.

-- Disable foreign key checks temporarily for clean drop
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS withdrawals;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS deposits;
DROP TABLE IF EXISTS deposit_methods;
DROP TABLE IF EXISTS crypto_wallets;
DROP TABLE IF EXISTS coins;
DROP TABLE IF EXISTS bank_wallets;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    routing_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    role VARCHAR(20) DEFAULT 'user',
    must_change_password TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Bank Wallets Table
CREATE TABLE bank_wallets (
    user_id VARCHAR(36) PRIMARY KEY,
    usd_balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Coins Table
CREATE TABLE coins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    symbol VARCHAR(10) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Crypto Wallets Table
CREATE TABLE crypto_wallets (
    user_id VARCHAR(36) NOT NULL,
    coin_id INT NOT NULL,
    balance DECIMAL(24,8) DEFAULT 0.00000000 NOT NULL,
    PRIMARY KEY (user_id, coin_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Deposit Methods Table
CREATE TABLE deposit_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    coin_id INT NOT NULL,
    wallet_address TEXT NOT NULL,
    deposit_amount DECIMAL(24,8) NOT NULL,
    usd_credit DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Deposits Table
CREATE TABLE deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    method_id INT,
    proof VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (method_id) REFERENCES deposit_methods(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Transfers Table
CREATE TABLE transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(36),
    receiver_id VARCHAR(36),
    amount DECIMAL(15,2) NOT NULL,
    usdt_fee DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Withdrawals Table
CREATE TABLE withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    bank_name VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Transactions Table
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Settings Table
CREATE TABLE settings (
    `key` VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Audit Logs Table
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- SEED DATA

-- Insert default coins
INSERT IGNORE INTO coins (name, symbol) VALUES 
('Tether', 'USDT'),
('Bitcoin', 'BTC'),
('Ethereum', 'ETH'),
('Binance Coin', 'BNB');

-- Insert default settings
INSERT IGNORE INTO settings (`key`, value) VALUES 
('transfer_fee_ratio_usd', '5000'),
('transfer_fee_ratio_usdt', '1'),
('withdrawal_fee_usdt', '5'),
('network_fee_usdt', '5');

-- Insert default Admin User
-- Password: '12345678' hashed with bcrypt: '$2a$10$L24zP031UvK91L9Xz2qCee3aNn47VvQO39vQO39vQO39vQO39vQO3'
INSERT IGNORE INTO users (id, name, email, password, account_number, routing_number, status, role, must_change_password) VALUES 
('00000000-0000-0000-0000-000000000000', 'System Admin', 'admin@gmail.com', '$2a$10$L24zP031UvK91L9Xz2qCee3aNn47VvQO39vQO39vQO39vQO39vQO3', '9999999999', '000000000', 'active', 'admin', 1);

INSERT IGNORE INTO bank_wallets (user_id, usd_balance) VALUES
('00000000-0000-0000-0000-000000000000', 0.00);
