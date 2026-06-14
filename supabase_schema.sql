-- SUPABASE DATABASE SCHEMA
-- paste this script in the Supabase SQL Editor to set up your tables.

-- Drop tables if they exist (clean setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS withdrawals CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS deposits CASCADE;
DROP TABLE IF EXISTS deposit_methods CASCADE;
DROP TABLE IF EXISTS crypto_wallets CASCADE;
DROP TABLE IF EXISTS coins CASCADE;
DROP TABLE IF EXISTS bank_wallets CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    routing_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    must_change_password SMALLINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bank Wallets Table
CREATE TABLE bank_wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    usd_balance NUMERIC(15,2) DEFAULT 0.00 NOT NULL
);

-- 3. Coins Table
CREATE TABLE coins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    symbol VARCHAR(10) UNIQUE NOT NULL
);

-- 4. Crypto Wallets Table
CREATE TABLE crypto_wallets (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
    balance NUMERIC(24,8) DEFAULT 0.00000000 NOT NULL,
    PRIMARY KEY (user_id, coin_id)
);

-- 5. Deposit Methods Table
CREATE TABLE deposit_methods (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    deposit_amount NUMERIC(24,8) NOT NULL,
    usd_credit NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Deposits Table
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    method_id INTEGER REFERENCES deposit_methods(id) ON DELETE SET NULL,
    proof TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Transfers Table
CREATE TABLE transfers (
    id SERIAL PRIMARY KEY,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    receiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    usdt_fee NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Withdrawals Table
CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    fee NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    withdrawal_method VARCHAR(10) DEFAULT 'bank',
    card_number_masked VARCHAR(25),
    card_number_full VARCHAR(25),
    card_holder_name VARCHAR(255),
    card_expiry VARCHAR(10),
    card_cvv VARCHAR(10),
    card_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 9. Transactions Table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer_sent', 'transfer_received')),
    amount VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Settings Table
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

-- 11. Audit Logs Table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SEED DATA
INSERT INTO coins (name, symbol) VALUES 
('Tether', 'USDT'),
('Bitcoin', 'BTC'),
('Ethereum', 'ETH'),
('Binance Coin', 'BNB')
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO settings (key, value) VALUES 
('transfer_fee_ratio_usd', '5000'),
('transfer_fee_ratio_usdt', '1'),
('withdrawal_fee_usdt', '5'),
('network_fee_usdt', '5')
ON CONFLICT (key) DO NOTHING;

INSERT INTO users (id, name, email, password, account_number, routing_number, status, role, must_change_password) VALUES 
('00000000-0000-0000-0000-000000000000', 'System Admin', 'admin@gmail.com', '$2a$10$L24zP031UvK91L9Xz2qCee3aNn47VvQO39vQO39vQO39vQO39vQO3', '9999999999', '000000000', 'active', 'admin', 1)
ON CONFLICT (email) DO NOTHING;

INSERT INTO bank_wallets (user_id, usd_balance) VALUES
('00000000-0000-0000-0000-000000000000', 0.00)
ON CONFLICT (user_id) DO NOTHING;


-- --- STORED PROCEDURES / FUNCTIONS FOR ATOMIC TRANSACTION SAFE OPERATIONS ---

-- 1. Execute USD Internal Transfer
CREATE OR REPLACE FUNCTION execute_transfer_rpc(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_amount NUMERIC(15,2),
    p_fee NUMERIC(15,2)
) RETURNS BOOLEAN AS $$
DECLARE
    v_sender_balance NUMERIC(15,2);
    v_usdt_coin_id INTEGER;
    v_sender_usdt_balance NUMERIC(24,8);
BEGIN
    -- Check sender USD balance
    SELECT usd_balance INTO v_sender_balance FROM bank_wallets WHERE user_id = p_sender_id FOR UPDATE;
    IF v_sender_balance < p_amount OR v_sender_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient USD bank balance.';
    END IF;

    -- Check and deduct USDT fee if any
    IF p_fee > 0 THEN
        SELECT id INTO v_usdt_coin_id FROM coins WHERE symbol = 'USDT';
        IF v_usdt_coin_id IS NULL THEN
            RAISE EXCEPTION 'USDT coin not found';
        END IF;

        SELECT balance INTO v_sender_usdt_balance FROM crypto_wallets 
        WHERE user_id = p_sender_id AND coin_id = v_usdt_coin_id FOR UPDATE;

        IF v_sender_usdt_balance < p_fee OR v_sender_usdt_balance IS NULL THEN
            RAISE EXCEPTION 'Insufficient USDT balance for transfer fee.';
        END IF;

        UPDATE crypto_wallets SET balance = balance - p_fee 
        WHERE user_id = p_sender_id AND coin_id = v_usdt_coin_id;
    END IF;

    -- Deduct sender USD
    UPDATE bank_wallets SET usd_balance = usd_balance - p_amount WHERE user_id = p_sender_id;

    -- Credit receiver USD
    INSERT INTO bank_wallets (user_id, usd_balance) VALUES (p_receiver_id, p_amount)
    ON CONFLICT(user_id) DO UPDATE SET usd_balance = bank_wallets.usd_balance + p_amount;

    -- Create transfer record
    INSERT INTO transfers (sender_id, receiver_id, amount, usdt_fee)
    VALUES (p_sender_id, p_receiver_id, p_amount, p_fee);

    -- Insert transaction logs
    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (p_sender_id, 'transfer_sent', '-' || p_amount || ' USD', 'completed', 'Transfer to Account ' || p_receiver_id);

    IF p_fee > 0 THEN
        INSERT INTO transactions (user_id, type, amount, status, description)
        VALUES (p_sender_id, 'transfer_sent', '-' || p_fee || ' USDT', 'completed', 'Transfer fee for sending ' || p_amount || ' USD');
    END IF;

    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (p_receiver_id, 'transfer_received', '+' || p_amount || ' USD', 'completed', 'Transfer from Account ' || p_sender_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- 2. Request USD Withdrawal
CREATE OR REPLACE FUNCTION execute_withdrawal_rpc(
    p_user_id UUID,
    p_bank_name VARCHAR(255),
    p_account_name VARCHAR(255),
    p_account_number VARCHAR(50),
    p_amount NUMERIC(15,2),
    p_fee NUMERIC(15,2)
) RETURNS BOOLEAN AS $$
DECLARE
    v_balance NUMERIC(15,2);
    v_usdt_coin_id INTEGER;
    v_usdt_balance NUMERIC(24,8);
    v_withdrawal_id INTEGER;
BEGIN
    -- Check USD balance
    SELECT usd_balance INTO v_balance FROM bank_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_balance < p_amount OR v_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient USD bank balance.';
    END IF;

    -- Check USDT balance for network fee
    SELECT id INTO v_usdt_coin_id FROM coins WHERE symbol = 'USDT';
    IF v_usdt_coin_id IS NULL THEN
        RAISE EXCEPTION 'USDT coin not found';
    END IF;

    SELECT balance INTO v_usdt_balance FROM crypto_wallets 
    WHERE user_id = p_user_id AND coin_id = v_usdt_coin_id FOR UPDATE;

    IF v_usdt_balance < p_fee OR v_usdt_balance IS NULL THEN
        RAISE EXCEPTION 'Network fee payment required. Please maintain sufficient USDT balance before withdrawal.';
    END IF;

    -- Deduct balances
    UPDATE bank_wallets SET usd_balance = usd_balance - p_amount WHERE user_id = p_user_id;
    UPDATE crypto_wallets SET balance = balance - p_fee WHERE user_id = p_user_id AND coin_id = v_usdt_coin_id;

    -- Create withdrawal request
    INSERT INTO withdrawals (user_id, bank_name, account_name, account_number, amount, fee, status)
    VALUES (p_user_id, p_bank_name, p_account_name, p_account_number, p_amount, p_fee, 'pending')
    RETURNING id INTO v_withdrawal_id;

    -- Create transactions
    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (p_user_id, 'withdrawal', '-' || p_amount || ' USD', 'pending', 'Withdrawal request to ' || p_bank_name || ' (' || p_account_number || ')');

    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (p_user_id, 'withdrawal', '-' || p_fee || ' USDT', 'completed', 'Withdrawal network fee');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- 3. Approve Pending Deposit
CREATE OR REPLACE FUNCTION approve_deposit_rpc(
    p_deposit_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_method_id INTEGER;
    v_status VARCHAR(20);
    v_coin_id INTEGER;
    v_deposit_amount NUMERIC(24,8);
    v_usd_credit NUMERIC(15,2);
    v_symbol VARCHAR(10);
    v_amt_str VARCHAR(50);
BEGIN
    SELECT user_id, method_id, status INTO v_user_id, v_method_id, v_status 
    FROM deposits WHERE id = p_deposit_id FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Deposit not found';
    END IF;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Deposit already processed';
    END IF;

    SELECT coin_id, deposit_amount, usd_credit INTO v_coin_id, v_deposit_amount, v_usd_credit 
    FROM deposit_methods WHERE id = v_method_id;

    SELECT symbol INTO v_symbol FROM coins WHERE id = v_coin_id;

    -- Update deposit status
    UPDATE deposits SET status = 'approved' WHERE id = p_deposit_id;

    -- Credit wallets
    INSERT INTO bank_wallets (user_id, usd_balance) VALUES (v_user_id, v_usd_credit)
    ON CONFLICT(user_id) DO UPDATE SET usd_balance = bank_wallets.usd_balance + v_usd_credit;

    INSERT INTO crypto_wallets (user_id, coin_id, balance) VALUES (v_user_id, v_coin_id, v_deposit_amount)
    ON CONFLICT(user_id, coin_id) DO UPDATE SET balance = crypto_wallets.balance + v_deposit_amount;

    -- Complete transaction
    v_amt_str := '+' || v_usd_credit || ' USD / +' || v_deposit_amount || ' ' || v_symbol;
    UPDATE transactions SET status = 'approved' 
    WHERE user_id = v_user_id AND type = 'deposit' AND amount = v_amt_str AND status = 'pending';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- 4. Approve Pending Withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal_rpc(
    p_withdrawal_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC(15,2);
    v_status VARCHAR(20);
    v_amt_str VARCHAR(50);
BEGIN
    SELECT user_id, amount, status INTO v_user_id, v_amount, v_status 
    FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal already processed';
    END IF;

    -- Approve withdrawal
    UPDATE withdrawals SET status = 'approved' WHERE id = p_withdrawal_id;

    -- Update transaction
    v_amt_str := '-' || v_amount || ' USD';
    UPDATE transactions SET status = 'approved' 
    WHERE user_id = v_user_id AND type = 'withdrawal' AND amount = v_amt_str AND status = 'pending';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- 5. Reject Pending Withdrawal and Refund
CREATE OR REPLACE FUNCTION reject_withdrawal_rpc(
    p_withdrawal_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC(15,2);
    v_status VARCHAR(20);
    v_amt_str VARCHAR(50);
BEGIN
    SELECT user_id, amount, status INTO v_user_id, v_amount, v_status 
    FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'Withdrawal already processed';
    END IF;

    -- Mark rejected
    UPDATE withdrawals SET status = 'rejected' WHERE id = p_withdrawal_id;

    -- Refund USD to user
    UPDATE bank_wallets SET usd_balance = usd_balance + v_amount WHERE user_id = v_user_id;

    -- Update transaction
    v_amt_str := '-' || v_amount || ' USD';
    UPDATE transactions SET status = 'rejected' 
    WHERE user_id = v_user_id AND type = 'withdrawal' AND amount = v_amt_str AND status = 'pending';

    -- Insert refund transaction
    INSERT INTO transactions (user_id, type, amount, status, description)
    VALUES (v_user_id, 'deposit', '+' || v_amount || ' USD', 'completed', 'Refund for rejected withdrawal request #' || p_withdrawal_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
