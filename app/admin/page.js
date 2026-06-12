'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
    const router = useRouter();
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, users, methods, deposits, withdrawals, transfers, settings, logs

    // Data lists
    const [users, setUsers] = useState([]);
    const [methods, setMethods] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [settings, setSettings] = useState({});
    const [coins, setCoins] = useState([]);
    const [allCoins, setAllCoins] = useState([]);
    const [logs, setLogs] = useState([]);

    // UI overlays
    const [editingUser, setEditingUser] = useState(null);
    const [editUsdBalance, setEditUsdBalance] = useState('');
    const [editCryptoBalances, setEditCryptoBalances] = useState({}); // coin symbol -> value
    const [editingMethod, setEditingMethod] = useState(null);

    // Method form
    const [methodCoinId, setMethodCoinId] = useState('');
    const [methodWalletAddr, setMethodWalletAddr] = useState('');
    const [methodDepositAmt, setMethodDepositAmt] = useState('');
    const [methodUsdCredit, setMethodUsdCredit] = useState('');

    // Settings form
    const [feeRatioUsd, setFeeRatioUsd] = useState('');
    const [feeRatioUsdt, setFeeRatioUsdt] = useState('');
    const [feeWithdrawalUsdt, setFeeWithdrawalUsdt] = useState('');
    const [feeNetworkUsdt, setFeeNetworkUsdt] = useState('');

    // Verification check & load
    const loadAdminData = async () => {
        try {
            const meRes = await fetch('/api/auth/me');
            if (!meRes.ok) {
                router.push('/login');
                return;
            }
            const meData = await meRes.json();
            if (meData.user?.role !== 'admin') {
                router.push('/dashboard');
                return;
            }
            if (meData.user?.must_change_password === 1) {
                router.push('/admin/change-password');
                return;
            }
            setAdmin(meData.user);

            // Fetch lists
            const usersRes = await fetch('/api/admin/users');
            const methodsRes = await fetch('/api/admin/deposit-methods');
            const depositsRes = await fetch('/api/admin/deposits');
            const withdrawalsRes = await fetch('/api/admin/withdrawals');
            const transfersRes = await fetch('/api/admin/transfers');
            const settingsRes = await fetch('/api/admin/settings');
            const logsRes = await fetch('/api/admin/logs');

            if (usersRes.ok) setUsers((await usersRes.json()).users);
            if (methodsRes.ok) {
                const methodsData = await methodsRes.json();
                setMethods(methodsData.methods);
                setAllCoins(methodsData.allCoins || []);
                if (methodsData.allCoins?.length > 0) {
                    setMethodCoinId(methodsData.allCoins[0].id);
                }
            }
            if (depositsRes.ok) setDeposits((await depositsRes.json()).deposits);
            if (withdrawalsRes.ok) setWithdrawals((await withdrawalsRes.json()).withdrawals);
            if (transfersRes.ok) setTransfers((await transfersRes.json()).transfers);
            if (logsRes.ok) setLogs((await logsRes.json()).logs);

            if (settingsRes.ok) {
                const s = (await settingsRes.json()).settings;
                setSettings(s);
                setFeeRatioUsd(s.transfer_fee_ratio_usd);
                setFeeRatioUsdt(s.transfer_fee_ratio_usdt);
                setFeeWithdrawalUsdt(s.withdrawal_fee_usdt || '5');
                setFeeNetworkUsdt(s.network_fee_usdt);
            }

            const dashRes = await fetch('/api/user/dashboard');
            if (dashRes.ok) {
                const dashData = await dashRes.json();
                setCoins(dashData.coins);
            }
        } catch (e) {
            console.error("Admin load error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAdminData();
        if (typeof document !== 'undefined') {
            document.body.className = "hold-transition sidebar-mini layout-fixed bg-light";
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.className = "";
            }
        };
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const toggleSidebar = () => {
        if (typeof document !== 'undefined') {
            const body = document.body;
            if (window.innerWidth < 992) {
                if (body.classList.contains('sidebar-open')) {
                    body.classList.remove('sidebar-open');
                    body.classList.add('sidebar-closed');
                } else {
                    body.classList.add('sidebar-open');
                    body.classList.remove('sidebar-closed');
                }
            } else {
                if (body.classList.contains('sidebar-collapse')) {
                    body.classList.remove('sidebar-collapse');
                } else {
                    body.classList.add('sidebar-collapse');
                }
            }
        }
    };

    // --- USER ACTIONS ---
    const toggleUserStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus })
            });
            if (res.ok) {
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteUser = async (userId) => {
        if (!confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
            if (res.ok) {
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const openEditUserModal = (user) => {
        setEditingUser(user);
        setEditUsdBalance(user.usd_balance);
        const cryptos = {};
        coins.forEach(c => {
            cryptos[c.symbol] = user.cryptoBalances[c.symbol] || 0;
        });
        setEditCryptoBalances(cryptos);
    };

    const handleSaveUserBalances = async () => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: editingUser.id,
                    name: editingUser.name,
                    usdBalance: editUsdBalance,
                    cryptoBalances: editCryptoBalances
                })
            });
            if (res.ok) {
                setEditingUser(null);
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- DEPOSIT METHOD ACTIONS ---
    const handleSaveMethod = async (e) => {
        e.preventDefault();
        const url = '/api/admin/deposit-methods';
        const method = editingMethod ? 'PUT' : 'POST';
        const payload = {
            coinId: methodCoinId,
            walletAddress: methodWalletAddr,
            depositAmount: methodDepositAmt,
            usdCredit: methodUsdCredit
        };
        if (editingMethod) payload.id = editingMethod.id;

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setEditingMethod(null);
                setMethodWalletAddr('');
                setMethodDepositAmt('');
                setMethodUsdCredit('');
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const editMethod = (m) => {
        setEditingMethod(m);
        setMethodCoinId(m.coin_id);
        setMethodWalletAddr(m.wallet_address);
        setMethodDepositAmt(m.deposit_amount);
        setMethodUsdCredit(m.usd_credit);
    };

    const deleteMethod = async (id) => {
        if (!confirm("Are you sure you want to delete this deposit method?")) return;
        try {
            const res = await fetch(`/api/admin/deposit-methods?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- DEPOSIT APPROVALS ---
    const processDeposit = async (depositId, action) => {
        try {
            const res = await fetch('/api/admin/deposits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depositId, action })
            });
            if (res.ok) {
                loadAdminData();
            } else {
                const err = await res.json();
                alert(err.error || "Failed to process deposit.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- WITHDRAWAL APPROVALS ---
    const processWithdrawal = async (withdrawalId, action) => {
        try {
            const res = await fetch('/api/admin/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId, action })
            });
            if (res.ok) {
                loadAdminData();
            } else {
                const err = await res.json();
                alert(err.error || "Failed to process withdrawal.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // --- SETTINGS ACTIONS ---
    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transfer_fee_ratio_usd: feeRatioUsd,
                    transfer_fee_ratio_usdt: feeRatioUsdt,
                    withdrawal_fee_usdt: feeWithdrawalUsdt,
                    network_fee_usdt: feeNetworkUsdt
                })
            });
            if (res.ok) {
                alert("Platform settings updated successfully.");
                loadAdminData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white">
                <div className="spinner-border text-warning mb-3"></div>
                <div>Syncing AdminLTE System Core...</div>
            </div>
        );
    }

    // Metric summaries
    const pendingDeposits = deposits.filter(d => d.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
    const totalUsersCount = users.filter(u => u.role !== 'admin').length;

    return (
        <div className="hold-transition sidebar-mini layout-fixed min-vh-100 bg-light" style={{
            fontFamily: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        }}>
            {/* Inject AdminLTE CDN Stylesheet specific for admin dashboard */}
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/css/adminlte.min.css" />

            <div className="wrapper">
                {/* Navbar */}
                <nav className="main-header navbar navbar-expand navbar-white navbar-light border-bottom">
                    <ul className="navbar-nav">
                        <li className="nav-item">
                            <button onClick={toggleSidebar} className="nav-link btn border-0 bg-transparent text-secondary" role="button" title="Toggle Sidebar">
                                <i className="fas fa-bars"></i>
                            </button>
                        </li>
                        <li className="nav-item d-none d-sm-inline-block">
                            <span className="nav-link font-weight-bold text-dark mb-0">PND Bank Control Center</span>
                        </li>
                    </ul>
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item d-flex align-items-center gap-3">
                            <span className="text-secondary small">Signed in as <b>System Administrator</b></span>
                            <button onClick={handleLogout} className="btn btn-sm btn-danger px-3">
                                <i className="fa-solid fa-right-from-bracket mr-1"></i>Logout
                            </button>
                        </li>
                    </ul>
                </nav>

                {/* Sidebar */}
                <aside className="main-sidebar sidebar-dark-primary elevation-4" style={{ minHeight: '100vh' }}>
                    <div className="brand-link text-center border-bottom border-secondary">
                        <span className="brand-text font-weight-light font-weight-bold" style={{ letterSpacing: '1.5px' }}>PND BANK HQ</span>
                    </div>

                    <div className="sidebar py-3">
                        <nav className="mt-2">
                            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('overview')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'overview' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-gauge-high mr-2"></i>Overview
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('users')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'users' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-users mr-2"></i>User Management
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('methods')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'methods' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-coins mr-2"></i>Deposit Methods
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('deposits')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'deposits' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-arrow-down-long mr-2"></i>
                                        Deposit Approvals
                                        {pendingDeposits > 0 && <span className="badge badge-warning right">{pendingDeposits}</span>}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('withdrawals')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'withdrawals' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-arrow-up-long mr-2"></i>
                                        Withdrawal Approvals
                                        {pendingWithdrawals > 0 && <span className="badge badge-warning right">{pendingWithdrawals}</span>}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('transfers')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'transfers' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-paper-plane mr-2"></i>Transfer Monitoring
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('settings')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'settings' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-sliders mr-2"></i>Fee Settings
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button onClick={() => setActiveTab('logs')} className={`nav-link text-left border-0 w-100 bg-transparent py-2.5 ${activeTab === 'logs' ? 'active' : 'text-white'}`}>
                                        <i className="nav-icon fa-solid fa-history mr-2"></i>Audit Logs
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </aside>

                {/* Content Wrapper */}
                <div className="content-wrapper p-4 bg-light" style={{ minHeight: 'calc(100vh - 57px)' }}>
                    {/* --- VIEW 1: OVERVIEW --- */}
                    {activeTab === 'overview' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">System Overview</h1>
                            </div>
                            <div className="row">
                                <div className="col-12 col-sm-6 col-md-3">
                                    <div className="info-box">
                                        <span className="info-box-icon bg-info elevation-1"><i className="fas fa-users"></i></span>
                                        <div className="info-box-content">
                                            <span className="info-box-text">Registered Clients</span>
                                            <span className="info-box-number font-weight-bold">{totalUsersCount}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6 col-md-3">
                                    <div className="info-box">
                                        <span className="info-box-icon bg-warning elevation-1"><i className="fas fa-arrow-down"></i></span>
                                        <div className="info-box-content">
                                            <span className="info-box-text">Pending Deposits</span>
                                            <span className="info-box-number font-weight-bold">{pendingDeposits}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6 col-md-3">
                                    <div className="info-box">
                                        <span className="info-box-icon bg-danger elevation-1"><i className="fas fa-arrow-up"></i></span>
                                        <div className="info-box-content">
                                            <span className="info-box-text">Pending Withdrawals</span>
                                            <span className="info-box-number font-weight-bold">{pendingWithdrawals}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6 col-md-3">
                                    <div className="info-box">
                                        <span className="info-box-icon bg-success elevation-1"><i className="fas fa-wallet"></i></span>
                                        <div className="info-box-content">
                                            <span className="info-box-text">Total System Transfers</span>
                                            <span className="info-box-number font-weight-bold">{transfers.length}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Welcome card */}
                            <div className="card card-outline card-primary mt-3">
                                <div className="card-body">
                                    <h5>Welcome to PND Banking Administrator Panel!</h5>
                                    <p className="text-secondary mb-0">Use the left sidebar navigation to approve transactions, adjust customer accounts, manage global fee ratios, or monitor system-wide logs.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 2: USER MANAGEMENT --- */}
                    {activeTab === 'users' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">User Management</h1>
                            </div>
                            <div className="card">
                                <div className="card-body p-0 table-responsive">
                                    <table className="table table-striped table-hover align-middle mb-0">
                                        <thead className="thead-light">
                                            <tr>
                                                <th>Name / Email</th>
                                                <th>Account Details</th>
                                                <th>USD Balance</th>
                                                <th>Crypto Balances</th>
                                                <th>Status</th>
                                                <th className="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td>
                                                        <div className="font-weight-bold">{u.name}</div>
                                                        <div className="text-secondary small">{u.email}</div>
                                                    </td>
                                                    <td>
                                                        <div className="small"><b>Acct:</b> {u.account_number}</div>
                                                        <div className="small"><b>Route:</b> {u.routing_number}</div>
                                                    </td>
                                                    <td className="font-weight-bold">${parseFloat(u.usd_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td>
                                                        <div className="small">
                                                            {Object.entries(u.cryptoBalances).map(([sym, bal]) => (
                                                                <span key={sym} className="badge bg-secondary mr-1 px-2 py-1">{parseFloat(bal).toFixed(4)} {sym}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {u.status === 'suspended' ? (
                                                            <span className="badge badge-danger">Suspended</span>
                                                        ) : (
                                                            <span className="badge badge-success">Active</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="d-flex justify-content-center gap-1">
                                                            <button onClick={() => openEditUserModal(u)} className="btn btn-xs btn-primary px-2" title="Edit Balances">
                                                                <i className="fas fa-edit mr-1"></i>Edit Balances
                                                            </button>
                                                            <button 
                                                                onClick={() => toggleUserStatus(u.id, u.status)} 
                                                                className={`btn btn-xs ${u.status === 'suspended' ? 'btn-success' : 'btn-warning'} px-2`}
                                                            >
                                                                {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                                                            </button>
                                                            {u.role !== 'admin' && (
                                                                <button onClick={() => deleteUser(u.id)} className="btn btn-xs btn-danger px-2">
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 3: DEPOSIT METHODS --- */}
                    {activeTab === 'methods' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Deposit Method Configurations</h1>
                            </div>
                            
                            <div className="row g-4">
                                {/* Configuration Form */}
                                <div className="col-md-4">
                                    <div className="card">
                                        <div className="card-header bg-primary text-white">
                                            <h3 className="card-title font-weight-bold">{editingMethod ? 'Edit Package' : 'Create Deposit Package'}</h3>
                                        </div>
                                        <form onSubmit={handleSaveMethod}>
                                            <div className="card-body d-flex flex-column gap-3">
                                                <div className="form-group mb-0">
                                                    <label className="small font-weight-bold">Select Crypto Coin</label>
                                                    <select 
                                                        className="form-control" 
                                                        value={methodCoinId}
                                                        onChange={e => setMethodCoinId(e.target.value)}
                                                        required
                                                    >
                                                        {allCoins.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group mb-0">
                                                    <label className="small font-weight-bold">Deposit Wallet Destination Address</label>
                                                    <input 
                                                        type="text" 
                                                        className="form-control font-monospace" 
                                                        placeholder="Enter blockchain address" 
                                                        value={methodWalletAddr}
                                                        onChange={e => setMethodWalletAddr(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group mb-0">
                                                    <label className="small font-weight-bold">Required Crypto Deposit Amount</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.00000001" 
                                                        className="form-control" 
                                                        placeholder="e.g. 5.0" 
                                                        value={methodDepositAmt}
                                                        onChange={e => setMethodDepositAmt(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group mb-0">
                                                    <label className="small font-weight-bold">Equivalent USD Credit Amount</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        className="form-control" 
                                                        placeholder="e.g. 50000.00" 
                                                        value={methodUsdCredit}
                                                        onChange={e => setMethodUsdCredit(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="card-footer d-flex gap-2">
                                                <button type="submit" className="btn btn-success font-weight-bold flex-grow-1">
                                                    {editingMethod ? 'Save Changes' : 'Create Package'}
                                                </button>
                                                {editingMethod && (
                                                    <button type="button" className="btn btn-secondary" onClick={() => {
                                                        setEditingMethod(null);
                                                        setMethodWalletAddr('');
                                                        setMethodDepositAmt('');
                                                        setMethodUsdCredit('');
                                                    }}>Cancel</button>
                                                )}
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* Current Packages List */}
                                <div className="col-md-8">
                                    <div className="card">
                                        <div className="card-body p-0 table-responsive">
                                            <table className="table table-striped align-middle mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Asset</th>
                                                        <th>Address</th>
                                                        <th>Cost</th>
                                                        <th>USD Credit</th>
                                                        <th className="text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {methods.map(m => (
                                                        <tr key={m.id}>
                                                            <td><b>{m.coin_symbol || m.coins?.symbol}</b> ({m.coin_name || m.coins?.name})</td>
                                                            <td className="font-monospace small text-break">{m.wallet_address}</td>
                                                            <td className="font-weight-bold">{m.deposit_amount} {m.coin_symbol || m.coins?.symbol}</td>
                                                            <td className="text-success font-weight-bold">${parseFloat(m.usd_credit).toLocaleString()} USD</td>
                                                            <td className="text-center">
                                                                <button onClick={() => editMethod(m)} className="btn btn-xs btn-primary mr-1"><i className="fas fa-edit"></i></button>
                                                                <button onClick={() => deleteMethod(m.id)} className="btn btn-xs btn-danger"><i className="fas fa-trash"></i></button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 4: DEPOSIT APPROVALS --- */}
                    {activeTab === 'deposits' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Pending Deposits</h1>
                            </div>
                            <div className="card">
                                <div className="card-body p-0 table-responsive">
                                    <table className="table table-striped align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Client Info</th>
                                                <th>Package</th>
                                                <th>Receipt Image</th>
                                                <th>Submitted Date</th>
                                                <th>Status</th>
                                                <th className="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deposits.map(d => (
                                                <tr key={d.id}>
                                                    <td>
                                                        <div><b>{d.users?.name || d.user_name}</b></div>
                                                        <div className="text-secondary small">{d.users?.email || d.user_email}</div>
                                                    </td>
                                                    <td>
                                                        <div><b>${parseFloat(d.usd_credit || d.deposit_methods?.usd_credit || 0).toLocaleString()} USD</b></div>
                                                        <div className="small text-secondary">Costs {d.deposit_amount || d.deposit_methods?.deposit_amount} {d.coin_symbol || d.deposit_methods?.coins?.symbol}</div>
                                                    </td>
                                                    <td>
                                                        <a href={d.proof} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-info">
                                                            <i className="fas fa-eye mr-1"></i>View Slip File
                                                        </a>
                                                    </td>
                                                    <td>{new Date(d.created_at).toLocaleString()}</td>
                                                    <td>
                                                        {d.status === 'pending' && <span className="badge badge-warning">Pending Approval</span>}
                                                        {d.status === 'approved' && <span className="badge badge-success">Approved</span>}
                                                        {d.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        {d.status === 'pending' ? (
                                                            <div className="d-flex justify-content-center gap-1">
                                                                <button onClick={() => processDeposit(d.id, 'approve')} className="btn btn-xs btn-success px-3">Approve</button>
                                                                <button onClick={() => processDeposit(d.id, 'reject')} className="btn btn-xs btn-danger px-3">Reject</button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-secondary small">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 5: WITHDRAWAL APPROVALS --- */}
                    {activeTab === 'withdrawals' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Pending Withdrawals</h1>
                            </div>
                            <div className="card">
                                <div className="card-body p-0 table-responsive">
                                    <table className="table table-striped align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Client Info</th>
                                                <th>Bank Routing Info</th>
                                                <th>Amount</th>
                                                <th>Network Fee Paid</th>
                                                <th>Submitted Date</th>
                                                <th>Status</th>
                                                <th className="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawals.map(w => (
                                                <tr key={w.id}>
                                                    <td>
                                                        <div><b>{w.users?.name || w.user_name}</b></div>
                                                        <div className="text-secondary small">{w.users?.email || w.user_email}</div>
                                                    </td>
                                                    <td>
                                                        <div><b>Bank:</b> {w.bank_name}</div>
                                                        <div><b>Acct Name:</b> {w.account_name}</div>
                                                        <div className="font-monospace"><b>Acct #:</b> {w.account_number}</div>
                                                    </td>
                                                    <td className="font-weight-bold text-danger">-${parseFloat(w.amount).toLocaleString()} USD</td>
                                                    <td className="font-weight-bold text-warning">{w.fee} USDT</td>
                                                    <td>{new Date(w.created_at).toLocaleString()}</td>
                                                    <td>
                                                        {w.status === 'pending' && <span className="badge badge-warning">Pending Approval</span>}
                                                        {w.status === 'approved' && <span className="badge badge-success">Approved / Completed</span>}
                                                        {w.status === 'rejected' && <span className="badge badge-danger">Rejected / Refunded</span>}
                                                    </td>
                                                    <td className="text-center">
                                                        {w.status === 'pending' ? (
                                                            <div className="d-flex justify-content-center gap-1">
                                                                <button onClick={() => processWithdrawal(w.id, 'approve')} className="btn btn-xs btn-success px-3">Approve</button>
                                                                <button onClick={() => processWithdrawal(w.id, 'reject')} className="btn btn-xs btn-danger px-3">Reject</button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-secondary small">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 6: TRANSFER MONITORING --- */}
                    {activeTab === 'transfers' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Transfer Audit Trail</h1>
                            </div>
                            <div className="card">
                                <div className="card-body p-0 table-responsive">
                                    <table className="table table-striped align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Sender Details</th>
                                                <th>Receiver Details</th>
                                                <th className="text-right">USD Amount</th>
                                                <th className="text-right">USDT Fee Deducted</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transfers.map(t => (
                                                <tr key={t.id}>
                                                    <td className="font-monospace small">{new Date(t.created_at).toLocaleString()}</td>
                                                    <td>
                                                        <div><b>{t.sender?.name || t.sender_name}</b></div>
                                                        <div className="text-secondary small font-monospace">Acct: {t.sender?.account_number || t.sender_account}</div>
                                                    </td>
                                                    <td>
                                                        <div><b>{t.receiver?.name || t.receiver_name}</b></div>
                                                        <div className="text-secondary small font-monospace">Acct: {t.receiver?.account_number || t.receiver_account}</div>
                                                    </td>
                                                    <td className="font-weight-bold text-right text-success">${parseFloat(t.amount).toLocaleString()} USD</td>
                                                    <td className="font-weight-bold text-right text-warning">{t.usdt_fee} USDT</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 7: FEE SETTINGS --- */}
                    {activeTab === 'settings' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Global Fee Configurations</h1>
                            </div>
                            <div className="card card-primary">
                                <form onSubmit={handleSaveSettings}>
                                    <div className="card-body d-flex flex-column gap-4" style={{ maxWidth: '500px' }}>
                                        <div>
                                            <h6 className="font-weight-bold mb-2">USD Internal Transfer Fee Rules</h6>
                                            <div className="row g-2 align-items-center">
                                                <div className="col-auto">Every</div>
                                                <div className="col">
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        value={feeRatioUsd}
                                                        onChange={e => setFeeRatioUsd(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-auto">USD Transferred, Requires</div>
                                                <div className="col">
                                                    <input 
                                                        type="number" 
                                                        className="form-control" 
                                                        value={feeRatioUsdt}
                                                        onChange={e => setFeeRatioUsdt(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                                <div className="col-auto">USDT</div>
                                            </div>
                                        </div>

                                        <hr className="my-1" />

                                        <div>
                                            <label className="font-weight-bold mb-1">USD Withdrawal Network Fee (USDT)</label>
                                            <div className="input-group">
                                                <input 
                                                    type="number" 
                                                    className="form-control" 
                                                    value={feeNetworkUsdt}
                                                    onChange={e => setFeeNetworkUsdt(e.target.value)}
                                                    required
                                                />
                                                <span className="input-group-text bg-light font-weight-bold">USDT</span>
                                            </div>
                                            <small className="text-secondary">Deducted from the user's USDT wallet during a bank withdrawal request.</small>
                                        </div>
                                    </div>
                                    <div className="card-footer">
                                        <button type="submit" className="btn btn-primary font-weight-bold px-4">Update Settings</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 8: AUDIT LOGS --- */}
                    {activeTab === 'logs' && (
                        <div>
                            <div className="content-header p-0 mb-4">
                                <h1 className="m-0 font-weight-bold text-dark">Audit Logs</h1>
                            </div>
                            <div className="card">
                                <div className="card-body p-0 table-responsive">
                                    <table className="table table-striped align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>User</th>
                                                <th>Action</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map(l => (
                                                <tr key={l.id} style={{ fontSize: '13px' }}>
                                                    <td className="font-monospace small">{new Date(l.created_at).toLocaleString()}</td>
                                                    <td>{l.users?.email || l.user_email || <span className="text-secondary">System</span>}</td>
                                                    <td><span className="badge badge-secondary">{l.action.toUpperCase()}</span></td>
                                                    <td>{l.details}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Mobile sidebar overlay wrapper */}
                <div id="sidebar-overlay" onClick={toggleSidebar}></div>
            </div>

            {/* --- DIALOG MODAL: EDIT USER BALANCES --- */}
            {editingUser && (
                <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title font-weight-bold">Edit User Account & Balances</h5>
                                <button type="button" className="close" onClick={() => setEditingUser(null)}>&times;</button>
                            </div>
                            <div className="modal-body d-flex flex-column gap-3">
                                <div>
                                    <span className="text-secondary small d-block">CLIENT</span>
                                    <b>{editingUser.name}</b> ({editingUser.email})
                                </div>

                                <div className="form-group mb-0">
                                    <label className="small font-weight-bold">USD Bank Balance ($)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="form-control" 
                                        value={editUsdBalance}
                                        onChange={e => setEditUsdBalance(e.target.value)}
                                        required
                                    />
                                </div>

                                <h6 className="font-weight-bold mt-2 mb-0">Crypto Balances</h6>
                                {coins.map(c => (
                                    <div key={c.id} className="form-group mb-0">
                                        <label className="small font-weight-bold">{c.name} ({c.symbol})</label>
                                        <input 
                                            type="number" 
                                            step="0.00000001" 
                                            className="form-control" 
                                            value={editCryptoBalances[c.symbol] || 0}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setEditCryptoBalances({
                                                    ...editCryptoBalances,
                                                    [c.symbol]: val
                                                });
                                            }}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Close</button>
                                <button type="button" className="btn btn-primary font-weight-bold" onClick={handleSaveUserBalances}>Save Balances</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
