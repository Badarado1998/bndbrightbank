'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [dashboardMode, setDashboardMode] = useState('banking'); // 'banking' or 'crypto'
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        usd_balance: 0,
        crypto_balances: {},
        transactions: [],
        deposit_methods: [],
        settings: {},
        coins: []
    });

    // Modals visibility
    const [showTransfer, setShowTransfer] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);

    // Transfer wizard state
    const [transferStep, setTransferStep] = useState(1);
    const [recipientAcct, setRecipientAcct] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);
    const [transferError, setTransferError] = useState('');

    // Deposit state
    const [selectedMethodId, setSelectedMethodId] = useState('');
    const [depositProof, setDepositProof] = useState(null);
    const [depositLoading, setDepositLoading] = useState(false);
    const [depositError, setDepositError] = useState('');
    const [depositSuccess, setDepositSuccess] = useState('');

    // Withdrawal state
    const [withdrawBank, setWithdrawBank] = useState('');
    const [withdrawAcctName, setWithdrawAcctName] = useState('');
    const [withdrawAcctNum, setWithdrawAcctNum] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawError, setWithdrawError] = useState('');

    // Load user and dashboard data
    const fetchDashboardData = async () => {
        try {
            const meRes = await fetch('/api/auth/me');
            if (!meRes.ok) {
                router.push('/login');
                return;
            }
            const meData = await meRes.json();
            setUser(meData.user);

            const dashRes = await fetch('/api/user/dashboard');
            if (dashRes.ok) {
                const dashData = await dashRes.json();
                setData(dashData);
                if (dashData.deposit_methods.length > 0) {
                    setSelectedMethodId(dashData.deposit_methods[0].id);
                }
            }
        } catch (e) {
            console.error("Error fetching dashboard data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    // --- TRANSFER LOGIC ---
    const handleTransferLookup = async () => {
        if (!recipientAcct) return;
        setTransferLoading(true);
        setTransferError('');
        try {
            const res = await fetch(`/api/user/transfer?accountNumber=${recipientAcct}`);
            const lookup = await res.json();
            if (!res.ok) {
                setTransferError(lookup.error || "Recipient not found.");
            } else {
                setRecipientName(lookup.name);
                setTransferStep(2);
            }
        } catch (e) {
            setTransferError("Error searching account.");
        } finally {
            setTransferLoading(false);
        }
    };

    const handleTransferStep2 = () => {
        const amt = parseFloat(transferAmount);
        if (isNaN(amt) || amt <= 0) {
            setTransferError("Please enter a valid transfer amount.");
            return;
        }
        if (amt > data.usd_balance) {
            setTransferError("Insufficient USD bank balance.");
            return;
        }
        setTransferError('');
        setTransferStep(3); // Proceed to preview
    };

    const handleTransferConfirm = async () => {
        setTransferLoading(true);
        setTransferError('');
        try {
            const res = await fetch('/api/user/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientAccountNumber: recipientAcct,
                    amount: transferAmount
                })
            });
            const result = await res.json();
            if (!res.ok) {
                setTransferError(result.error || "Transfer failed.");
            } else {
                // Success
                if (window.Swal) {
                    window.Swal.fire({
                        icon: 'success',
                        title: 'Transfer Completed',
                        text: `Successfully sent $${parseFloat(transferAmount).toLocaleString()} USD to ${recipientName}.`,
                        background: '#1e293b',
                        color: '#fff',
                        confirmButtonColor: '#6366f1'
                    });
                }
                setShowTransfer(false);
                resetTransferWizard();
                fetchDashboardData();
            }
        } catch (e) {
            setTransferError("An error occurred during transfer.");
        } finally {
            setTransferLoading(false);
        }
    };

    const resetTransferWizard = () => {
        setTransferStep(1);
        setRecipientAcct('');
        setRecipientName('');
        setTransferAmount('');
        setTransferError('');
    };

    // Calculate USDT Fee based on amount
    const getTransferUsdtFee = () => {
        const amt = parseFloat(transferAmount) || 0;
        const ratioUsd = parseFloat(data.settings?.transfer_fee_ratio_usd || 5000);
        const ratioUsdt = parseFloat(data.settings?.transfer_fee_ratio_usdt || 1);
        return Math.floor(amt / ratioUsd) * ratioUsdt;
    };

    // --- DEPOSIT LOGIC ---
    const handleDepositSubmit = async (e) => {
        e.preventDefault();
        if (!depositProof) {
            setDepositError("Please select a file containing your payment proof.");
            return;
        }
        setDepositLoading(true);
        setDepositError('');
        setDepositSuccess('');

        const formData = new FormData();
        formData.append('methodId', selectedMethodId);
        formData.append('proof', depositProof);

        try {
            const res = await fetch('/api/user/deposit', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (!res.ok) {
                setDepositError(result.error || "Deposit failed.");
            } else {
                setDepositSuccess("Receipt uploaded successfully! Deposit is pending approval.");
                setDepositProof(null);
                setTimeout(() => {
                    setShowDeposit(false);
                    setDepositSuccess('');
                    fetchDashboardData();
                }, 2000);
            }
        } catch (err) {
            setDepositError("Error uploading deposit receipt.");
        } finally {
            setDepositLoading(false);
        }
    };

    // --- WITHDRAWAL LOGIC ---
    const handleWithdrawalSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(withdrawAmount);
        if (isNaN(amt) || amt <= 0) {
            setWithdrawError("Please enter a valid amount.");
            return;
        }
        if (amt > data.usd_balance) {
            setWithdrawError("Insufficient USD bank balance.");
            return;
        }

        // Show SweetAlert warning popup after filling and clicking Request
        if (window.Swal) {
            window.Swal.fire({
                icon: 'warning',
                title: 'Crypto Network Fee Required',
                text: `Please note that a network fee in crypto will be deducted from your crypto wallet to complete this USD withdrawal.`,
                background: '#1e293b',
                color: '#fff',
                showCancelButton: true,
                confirmButtonText: 'Confirm & Withdraw',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#eab308',
                cancelButtonColor: '#6b7280'
            }).then((res) => {
                if (res.isConfirmed) {
                    executeWithdrawalAPI(amt);
                }
            });
        } else {
            executeWithdrawalAPI(amt);
        }
    };

    const executeWithdrawalAPI = async (amt) => {
        setWithdrawLoading(true);
        setWithdrawError('');
        try {
            const res = await fetch('/api/user/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bankName: withdrawBank,
                    accountName: withdrawAcctName,
                    accountNumber: withdrawAcctNum,
                    amount: withdrawAmount
                })
            });
            const result = await res.json();
            if (!res.ok) {
                if (result.showFeePopup) {
                    if (window.Swal) {
                        window.Swal.fire({
                            icon: 'warning',
                            title: 'Crypto Network Fee Required',
                            text: 'Network fee payment required. Please maintain sufficient crypto balance before withdrawal.',
                            background: '#1e293b',
                            color: '#fff',
                            confirmButtonText: 'I Understand',
                            confirmButtonColor: '#eab308'
                        });
                    } else {
                        alert("Network fee payment required. Please maintain sufficient crypto balance before withdrawal.");
                    }
                }
                setWithdrawError(result.error || "Withdrawal failed.");
            } else {
                if (window.Swal) {
                    window.Swal.fire({
                        icon: 'success',
                        title: 'Withdrawal Pending',
                        text: `Withdrawal request of $${amt.toLocaleString()} USD has been created.`,
                        background: '#1e293b',
                        color: '#fff',
                        confirmButtonColor: '#6366f1'
                    });
                }
                setShowWithdraw(false);
                setWithdrawBank('');
                setWithdrawAcctName('');
                setWithdrawAcctNum('');
                setWithdrawAmount('');
                fetchDashboardData();
            }
        } catch (err) {
            setWithdrawError("Error processing withdrawal.");
        } finally {
            setWithdrawLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center text-white" style={{ background: '#070a13' }}>
                <div className="spinner-border text-indigo mb-3" style={{ width: '3rem', height: '3rem', color: '#6366f1' }} role="status"></div>
                <div className="fw-semibold text-light">Loading Secure Wallet Engine...</div>
            </div>
        );
    }

    const currentUsdtBalance = data.crypto_balances['USDT']?.balance || 0;

    return (
        <div className="min-vh-100 text-white pb-5" style={{
            background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Global Style Overrides for Perfect Legibility */}
            <style jsx global>{`
                body {
                    background-color: #090d16 !important;
                    color: #f8fafc !important;
                }
                .text-muted-light {
                    color: #94a3b8 !important; /* Premium light slate text */
                }
                .text-muted-lighter {
                    color: #cbd5e1 !important; /* Even lighter slate */
                }
                .glass-card {
                    background: rgba(30, 41, 59, 0.45) !important;
                    backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3) !important;
                    border-radius: 20px !important;
                    transition: all 0.3s ease;
                }
                .glass-card:hover {
                    border-color: rgba(99, 102, 241, 0.25) !important;
                    box-shadow: 0 12px 40px 0 rgba(99, 102, 241, 0.12) !important;
                }
                .table-premium td, .table-premium th {
                    color: #f1f5f9 !important;
                    border-color: rgba(255, 255, 255, 0.05) !important;
                }
                .form-control-premium {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    color: #ffffff !important;
                    border-radius: 12px !important;
                    padding: 12px 16px !important;
                }
                .form-control-premium:focus {
                    background: rgba(15, 23, 42, 0.8) !important;
                    border-color: #6366f1 !important;
                    color: #ffffff !important;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
                }
                .form-control-premium::placeholder {
                    color: #64748b !important;
                }
                select.form-control-premium option {
                    background-color: #0f172a !important;
                    color: #ffffff !important;
                }
                .input-group-text-premium {
                    background: rgba(15, 23, 42, 0.6) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    border-right: none !important;
                    color: #94a3b8 !important;
                    border-radius: 12px 0 0 12px !important;
                }
                .input-group-premium-input {
                    border-radius: 0 12px 12px 0 !important;
                }
                .tx-row {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                .tx-row:hover {
                    background: rgba(255, 255, 255, 0.035) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4) !important;
                }
                .icon-container-deposit {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.03) 100%) !important;
                    border: 1px solid rgba(16, 185, 129, 0.2) !important;
                    color: #10b981 !important;
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .icon-container-withdraw {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.03) 100%) !important;
                    border: 1px solid rgba(245, 158, 11, 0.2) !important;
                    color: #f59e0b !important;
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .icon-container-sent {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.03) 100%) !important;
                    border: 1px solid rgba(239, 68, 68, 0.2) !important;
                    color: #ef4444 !important;
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .icon-container-received {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.03) 100%) !important;
                    border: 1px solid rgba(99, 102, 241, 0.2) !important;
                    color: #818cf8 !important;
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .badge-completed {
                    background: rgba(16, 185, 129, 0.08) !important;
                    border: 1px solid rgba(16, 185, 129, 0.2) !important;
                    color: #34d399 !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.5px;
                    font-size: 10px !important;
                    padding: 5px 12px !important;
                    border-radius: 30px !important;
                    text-transform: uppercase;
                }
                .badge-pending {
                    background: rgba(245, 158, 11, 0.08) !important;
                    border: 1px solid rgba(245, 158, 11, 0.2) !important;
                    color: #fbbf24 !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.5px;
                    font-size: 10px !important;
                    padding: 5px 12px !important;
                    border-radius: 30px !important;
                    text-transform: uppercase;
                }
                .badge-rejected {
                    background: rgba(239, 68, 68, 0.08) !important;
                    border: 1px solid rgba(239, 68, 68, 0.2) !important;
                    color: #f87171 !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.5px;
                    font-size: 10px !important;
                    padding: 5px 12px !important;
                    border-radius: 30px !important;
                    text-transform: uppercase;
                }
            `}</style>

            {/* Header / Navbar */}
            <nav className="navbar navbar-expand-lg border-bottom border-secondary border-opacity-10 py-3" style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)' }}>
                <div className="container px-4">
                    <div className="navbar-brand d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
                            <i className="fa-solid fa-building-columns text-white small"></i>
                        </div>
                        <span className="fw-bold tracking-wider fs-5 text-white" style={{ letterSpacing: '1px' }}>PND BANK</span>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                        <div className="d-none d-md-flex flex-column align-items-end me-2 text-end">
                            <span className="small fw-semibold text-white">{user?.name}</span>
                            <span className="text-muted-light" style={{ fontSize: '11px' }}>{user?.email}</span>
                        </div>
                        <button onClick={handleLogout} className="btn border-0 py-2 px-3 text-white d-flex align-items-center gap-2" style={{ background: 'rgba(239, 68, 68, 0.15)', borderRadius: '10px' }}>
                            <i className="fa-solid fa-power-off text-danger"></i>
                            <span className="small fw-semibold d-none d-sm-inline">Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Dashboard Workspace */}
            <div className="container mt-4 px-4">
                {/* Account Details Panel */}
                <div className="card border-0 mb-4 glass-card">
                    <div className="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div className="d-flex flex-wrap gap-4">
                            <div>
                                <span className="small text-muted-light d-block mb-1">ACCOUNT NUMBER (USD)</span>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="font-monospace fw-bold fs-5 tracking-wider text-white">{user?.account_number}</span>
                                    <button className="btn btn-sm btn-link p-0 text-indigo opacity-75 hover-opacity-100" onClick={() => {
                                        navigator.clipboard.writeText(user?.account_number);
                                        if (window.Swal) window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Account number copied', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
                                    }}>
                                        <i className="fa-regular fa-copy text-info"></i>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span className="small text-muted-light d-block mb-1">
                                    {user?.country === 'United Kingdom' ? 'SORT CODE' :
                                     user?.country === 'Australia' ? 'BSB CODE' :
                                     user?.country === 'Canada' ? 'TRANSIT CODE' :
                                     (user?.country === 'Germany' || user?.country === 'France') ? 'BIC / SWIFT CODE' :
                                     'ROUTING NUMBER'} ({user?.country ? user.country.toUpperCase() : 'UNITED STATES'})
                                </span>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="font-monospace fw-bold fs-5 tracking-wider text-white">{user?.routing_number}</span>
                                    <button className="btn btn-sm btn-link p-0 text-indigo opacity-75 hover-opacity-100" onClick={() => {
                                        navigator.clipboard.writeText(user?.routing_number);
                                        if (window.Swal) window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Code copied', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
                                    }}>
                                        <i className="fa-regular fa-copy text-info"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Switchable Dashboard Tab Selector */}
                        <div className="p-1 rounded-3 d-flex" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', width: 'fit-content' }}>
                            <button 
                                onClick={() => setDashboardMode('banking')}
                                className={`btn border-0 py-2 px-4 fw-semibold ${dashboardMode === 'banking' ? 'text-white' : 'text-muted-light'}`}
                                style={{
                                    background: dashboardMode === 'banking' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'transparent',
                                    borderRadius: '8px',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <i className="fa-solid fa-wallet me-2"></i>Fiat Banking
                            </button>
                            <button 
                                onClick={() => setDashboardMode('crypto')}
                                className={`btn border-0 py-2 px-4 fw-semibold ${dashboardMode === 'crypto' ? 'text-white' : 'text-muted-light'}`}
                                style={{
                                    background: dashboardMode === 'crypto' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'transparent',
                                    borderRadius: '8px',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <i className="fa-brands fa-ethereum me-2"></i>Crypto Wallet
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dashboard Mode Content */}
                <div className="row g-4">
                    {/* LEFT SIDE: MAIN ACTIONS & BALANCES */}
                    <div className="col-lg-8">
                        {dashboardMode === 'banking' ? (
                            /* --- FIAT BANKING DASHBOARD --- */
                            <div className="d-flex flex-column gap-4">
                                {/* USD Card */}
                                <div className="card border-0 p-4" style={{
                                    borderRadius: '24px',
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                }}>
                                    <div className="d-flex justify-content-between align-items-start mb-4">
                                        <div>
                                            <span className="small fw-bold tracking-widest uppercase" style={{ color: '#a5b4fc' }}>AVAILABLE USD BALANCE</span>
                                            <h2 className="display-4 fw-bold mt-1 text-white">${parseFloat(data.usd_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                                        </div>
                                        <div className="bg-white bg-opacity-10 rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                            <i className="fa-solid fa-dollar-sign fs-3" style={{ color: '#c084fc' }}></i>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="d-flex flex-wrap gap-3 mt-2">
                                        <button onClick={() => setShowTransfer(true)} className="btn border-0 py-3 px-4 fw-bold text-white flex-grow-1 d-flex align-items-center justify-content-center gap-2" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', borderRadius: '14px', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.2)' }}>
                                            <i className="fa-solid fa-paper-plane"></i>
                                            Transfer to Bank
                                        </button>
                                        <button onClick={() => setShowDeposit(true)} className="btn border-0 py-3 px-4 fw-bold text-white flex-grow-1 d-flex align-items-center justify-content-center gap-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}>
                                            <i className="fa-solid fa-arrow-down-long text-success"></i>
                                            Deposit USD
                                        </button>
                                        <button onClick={() => setShowWithdraw(true)} className="btn border-0 py-3 px-4 fw-bold text-white flex-grow-1 d-flex align-items-center justify-content-center gap-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}>
                                            <i className="fa-solid fa-arrow-up-long text-warning"></i>
                                            Withdrawal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* --- CRYPTO DASHBOARD --- */
                            <div className="d-flex flex-column gap-4">
                                <div>
                                    <h4 className="fw-bold mb-3 d-flex align-items-center gap-2 text-white">
                                        <i className="fa-solid fa-chart-pie text-indigo" style={{ color: '#a5b4fc' }}></i>
                                        Crypto Portfolios
                                    </h4>
                                    
                                    <div className="row g-3">
                                        {data.coins.map(coin => {
                                            const asset = data.crypto_balances[coin.symbol];
                                            const bal = asset ? parseFloat(asset.balance) : 0;
                                            return (
                                                <div key={coin.id} className="col-sm-6">
                                                    <div className="card border-0 p-4 glass-card">
                                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold fs-6 text-white" style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    background: coin.symbol === 'USDT' ? '#10b981' : coin.symbol === 'BTC' ? '#f59e0b' : coin.symbol === 'ETH' ? '#6366f1' : '#eab308'
                                                                }}>
                                                                    {coin.symbol[0]}
                                                                </div>
                                                                <div>
                                                                    <span className="fw-bold d-block text-white">{coin.symbol}</span>
                                                                    <span className="text-muted-light" style={{ fontSize: '11px' }}>{coin.name}</span>
                                                                </div>
                                                            </div>
                                                            <span className="badge bg-white bg-opacity-10 text-white rounded-pill px-3 py-1 font-monospace">ACTIVE</span>
                                                        </div>
                                                        <h3 className="fw-bold font-monospace mb-0 text-white">{bal.toFixed(8)}</h3>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TRANSACTION HISTORY TABLE */}
                        <div className="card border-0 p-4 mt-4 glass-card">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2 text-white">
                                    <div className="rounded-2 d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                        <i className="fa-solid fa-clock-rotate-left text-indigo" style={{ color: '#a5b4fc', fontSize: '14px' }}></i>
                                    </div>
                                    Transaction Activity
                                </h4>
                                <span className="text-muted-light font-monospace" style={{ fontSize: '11px' }}>{data.transactions.length} Total</span>
                            </div>
                            {data.transactions.length === 0 ? (
                                <div className="text-center py-5 d-flex flex-column align-items-center justify-content-center">
                                    <div className="rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '70px', height: '70px', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                        <i className="fa-solid fa-receipt text-muted-light fs-2 opacity-50"></i>
                                    </div>
                                    <h6 className="fw-bold text-white mb-1">No Activity Yet</h6>
                                    <div className="text-muted-light small" style={{ maxWidth: '250px' }}>Your deposit, transfer, and withdrawal actions will appear here.</div>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {/* Table-like headers for desktop */}
                                    <div className="row px-3 mb-1 d-none d-md-flex text-muted-light small font-weight-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>
                                        <div className="col-md-2">DATE / TIME</div>
                                        <div className="col-md-3">TRANSACTION TYPE</div>
                                        <div className="col-md-3">DESCRIPTION</div>
                                        <div className="col-md-2 text-end">AMOUNT</div>
                                        <div className="col-md-2 text-center">STATUS</div>
                                    </div>

                                    {/* Transaction Cards */}
                                    {data.transactions.map((tx) => {
                                        const d = new Date(tx.created_at);
                                        const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        const formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        const isCredit = tx.amount.startsWith('+');
                                        const amtColor = isCredit ? 'text-success' : 'text-danger';
                                        
                                        let typeIcon = null;
                                        let typeLabel = tx.type.replace('_', ' ').toUpperCase();
                                        let iconClass = "";

                                        if (tx.type === 'deposit') {
                                            typeIcon = <i className="fa-solid fa-arrow-down"></i>;
                                            iconClass = "icon-container-deposit";
                                        } else if (tx.type === 'withdrawal') {
                                            typeIcon = <i className="fa-solid fa-arrow-up"></i>;
                                            iconClass = "icon-container-withdraw";
                                        } else if (tx.type === 'transfer_sent') {
                                            typeIcon = <i className="fa-solid fa-arrow-right"></i>;
                                            iconClass = "icon-container-sent";
                                            typeLabel = "SENT TRANSFER";
                                        } else if (tx.type === 'transfer_received') {
                                            typeIcon = <i className="fa-solid fa-arrow-left"></i>;
                                            iconClass = "icon-container-received";
                                            typeLabel = "RECEIVED TRANSFER";
                                        } else {
                                            typeIcon = <i className="fa-solid fa-circle"></i>;
                                            iconClass = "icon-container-received";
                                        }

                                        let statusBadge = <span className="badge-pending">Pending</span>;
                                        if (tx.status === 'approved' || tx.status === 'completed') statusBadge = <span className="badge-completed">Completed</span>;
                                        if (tx.status === 'rejected') statusBadge = <span className="badge-rejected">Rejected</span>;

                                        return (
                                            <div 
                                                key={tx.id} 
                                                className="row align-items-center py-3 px-2 mx-0"
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                                    borderRadius: '16px',
                                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                {/* Date and Time */}
                                                <div className="col-12 col-md-2 mb-2 mb-md-0">
                                                    <div className="fw-semibold text-white" style={{ fontSize: '13px' }}>{formattedDate}</div>
                                                    <div className="text-muted-light font-monospace mt-0.5" style={{ fontSize: '11px' }}>{formattedTime}</div>
                                                </div>

                                                {/* Transaction Type */}
                                                <div className="col-12 col-md-3 mb-2 mb-md-0 d-flex align-items-center gap-3">
                                                    <div className={iconClass}>
                                                        {typeIcon}
                                                    </div>
                                                    <span className="fw-bold text-white" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>{typeLabel}</span>
                                                </div>

                                                {/* Description */}
                                                <div className="col-12 col-md-3 mb-2 mb-md-0 text-muted-lighter" style={{ fontSize: '13px' }}>
                                                    {tx.description}
                                                </div>

                                                {/* Amount */}
                                                <div className={`col-6 col-md-2 mb-2 mb-md-0 text-md-end font-monospace fw-bold ${amtColor}`} style={{ fontSize: '15px' }}>
                                                    {tx.amount}
                                                </div>

                                                {/* Status */}
                                                <div className="col-6 col-md-2 text-md-center text-end">
                                                    {statusBadge}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: FEES SETTINGS PANEL */}
                    <div className="col-lg-4">
                        <div className="d-flex flex-column gap-4">
                            {/* USDT Info card */}
                            <div className="card border-0 p-4 glass-card">
                                <span className="small text-muted-light mb-1">YOUR FEES BALANCE</span>
                                <h3 className="fw-bold font-monospace" style={{ color: '#34d399' }}>{parseFloat(currentUsdtBalance).toFixed(4)} USDT</h3>
                                <div className="small text-muted-light mt-1">Required to cover bank transfer & withdrawal fees.</div>
                            </div>

                            {/* Fee structure info box */}
                            <div className="card border-0 p-4 glass-card">
                                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-white">
                                    <i className="fa-solid fa-percent text-info"></i>
                                    Platform Fee Rates
                                </h5>
                                <div className="d-flex flex-column gap-3 fs-6">
                                    <div className="d-flex justify-content-between border-bottom border-secondary border-opacity-10 pb-2">
                                        <span className="text-muted-light">Internal Transfer</span>
                                        <span className="fw-semibold text-white">
                                            {data.settings?.transfer_fee_ratio_usdt || 1} USDT / ${parseInt(data.settings?.transfer_fee_ratio_usd || 5000).toLocaleString()} USD
                                        </span>
                                    </div>
                                    <div className="text-muted-lighter small mt-2 bg-white bg-opacity-5 p-2 rounded">
                                        <i className="fa-solid fa-info-circle me-1 text-info"></i>
                                        Fees are automatically deducted from your crypto USDT wallet during internal transfers.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODAL: TRANSFER WIZARD --- */}
            {showTransfer && (
                <div className="modal d-block animate-fade-in" tabIndex="-1" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 text-white p-4" style={{ borderRadius: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold text-white">Send USD Transfer</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowTransfer(false); resetTransferWizard(); }}></button>
                            </div>
                            
                            <div className="modal-body py-4">
                                {transferError && (
                                    <div className="alert alert-danger border-0 text-white small p-2 mb-3" style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                                        <i className="fa-solid fa-circle-exclamation me-2"></i>{transferError}
                                    </div>
                                )}

                                {/* STEP 1: Enter Account Number */}
                                {transferStep === 1 && (
                                    <div>
                                        <label className="small text-muted-light mb-2 fw-semibold">Recipient Account Number</label>
                                        <input 
                                            type="text" 
                                            className="form-control form-control-premium w-100 mb-4 font-monospace text-center fs-5"
                                            placeholder="Enter 10-digit account number"
                                            value={recipientAcct}
                                            onChange={e => setRecipientAcct(e.target.value)}
                                        />
                                        <button 
                                            onClick={handleTransferLookup} 
                                            className="btn btn-primary w-100 py-3 border-0 fw-bold d-flex align-items-center justify-content-center gap-2"
                                            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', borderRadius: '12px' }}
                                            disabled={transferLoading}
                                        >
                                            {transferLoading ? <span className="spinner-border spinner-border-sm"></span> : <><span>Find Account</span><i className="fa-solid fa-magnifying-glass"></i></>}
                                        </button>
                                    </div>
                                )}

                                {/* STEP 2: Enter Amount */}
                                {transferStep === 2 && (
                                    <div>
                                        <div className="p-3 rounded-3 mb-3 text-center border" style={{ background: 'rgba(15, 23, 42, 0.3)', borderColor: 'rgba(255,255,255,0.08)' }}>
                                            <span className="small text-muted-light d-block">RECIPIENT NAME</span>
                                            <span className="fw-bold fs-5 text-white">{recipientName}</span>
                                        </div>
                                        <label className="small text-muted-light mb-2 fw-semibold">Transfer Amount (USD)</label>
                                        <div className="input-group mb-4">
                                            <span className="input-group-text input-group-text-premium">$</span>
                                            <input 
                                                type="number" 
                                                className="form-control form-control-premium input-group-premium-input font-monospace text-white fs-5"
                                                placeholder="0.00"
                                                value={transferAmount}
                                                onChange={e => setTransferAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="d-flex gap-2">
                                            <button onClick={() => setTransferStep(1)} className="btn btn-secondary w-50 py-3 border-0" style={{ borderRadius: '12px' }}>Back</button>
                                            <button onClick={handleTransferStep2} className="btn btn-primary w-50 py-3 border-0 fw-bold" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', borderRadius: '12px' }}>Next</button>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: Preview Screen */}
                                {transferStep === 3 && (
                                    <div>
                                        <h6 className="fw-semibold text-muted-light mb-3 text-center">Review Transaction Details</h6>
                                        <div className="p-4 rounded-3 d-flex flex-column gap-3 mb-4" style={{ fontSize: '13px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div className="d-flex justify-content-between">
                                                <span className="text-muted-light">Sender Name</span>
                                                <span className="fw-semibold text-white">{user?.name}</span>
                                            </div>
                                            <div className="d-flex justify-content-between">
                                                <span className="text-muted-light">Sender Account</span>
                                                <span className="font-monospace text-white">{user?.account_number}</span>
                                            </div>
                                            <hr className="my-1 border-secondary border-opacity-25" />
                                            <div className="d-flex justify-content-between">
                                                <span className="text-muted-light">Recipient Name</span>
                                                <span className="fw-semibold text-white">{recipientName}</span>
                                            </div>
                                            <div className="d-flex justify-content-between">
                                                <span className="text-muted-light">Recipient Account</span>
                                                <span className="font-monospace text-white">{recipientAcct}</span>
                                            </div>
                                            <hr className="my-1 border-secondary border-opacity-25" />
                                            <div className="d-flex justify-content-between">
                                                <span className="text-muted-light">Amount</span>
                                                <span className="fw-bold text-white">${parseFloat(transferAmount).toLocaleString()} USD</span>
                                            </div>
                                            <div className="d-flex justify-content-between text-warning">
                                                <span>USDT Fee (deducted from crypto)</span>
                                                <span className="font-monospace fw-bold">{getTransferUsdtFee()} USDT</span>
                                            </div>
                                            <div className="d-flex justify-content-between fw-bold text-success fs-6 pt-2 border-top border-secondary border-opacity-25">
                                                <span>Total USD deduction</span>
                                                <span>${parseFloat(transferAmount).toLocaleString()} USD</span>
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2">
                                            <button onClick={() => setTransferStep(2)} className="btn btn-secondary w-50 py-3 border-0" style={{ borderRadius: '12px' }}>Back</button>
                                            <button 
                                                onClick={handleTransferConfirm} 
                                                className="btn btn-success w-50 py-3 border-0 fw-bold d-flex align-items-center justify-content-center gap-2" 
                                                style={{ borderRadius: '12px' }}
                                                disabled={transferLoading}
                                            >
                                                {transferLoading ? <span className="spinner-border spinner-border-sm"></span> : <><span>Confirm & Send</span><i className="fa-solid fa-circle-check"></i></>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: DEPOSIT USD (CRYPTO GATEWAY) --- */}
            {showDeposit && (
                <div className="modal d-block animate-fade-in" tabIndex="-1" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 text-white p-4" style={{ borderRadius: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold text-white">Deposit USD via Crypto</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowDeposit(false); setDepositProof(null); setDepositError(''); }}></button>
                            </div>

                            <form onSubmit={handleDepositSubmit}>
                                <div className="modal-body py-4">
                                    {depositError && (
                                        <div className="alert alert-danger border-0 text-white small p-2 mb-3" style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                                            <i className="fa-solid fa-circle-exclamation me-2"></i>{depositError}
                                        </div>
                                    )}
                                    {depositSuccess && (
                                        <div className="alert alert-success border-0 text-white small p-2 mb-3" style={{ background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px' }}>
                                            <i className="fa-solid fa-circle-check me-2"></i>{depositSuccess}
                                        </div>
                                    )}

                                    {/* Select Deposit Package */}
                                    <label className="small text-muted-light mb-2 fw-semibold">Choose Deposit Amount Package</label>
                                    <select 
                                        className="form-select form-control-premium w-100 mb-3"
                                        value={selectedMethodId}
                                        onChange={e => setSelectedMethodId(e.target.value)}
                                        required
                                    >
                                        {data.deposit_methods.map(m => (
                                            <option key={m.id} value={m.id}>
                                                Send {m.deposit_amount} {m.coin_symbol || m.coins?.symbol} → Credit ${parseFloat(m.usd_credit).toLocaleString()} USD
                                            </option>
                                        ))}
                                    </select>

                                    {/* Selected Method Details */}
                                    {(() => {
                                        const method = data.deposit_methods.find(m => String(m.id) === String(selectedMethodId));
                                        if (!method) return null;
                                        return (
                                            <div className="p-4 rounded-3 d-flex flex-column gap-3 mb-4" style={{ fontSize: '13px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div>
                                                    <span className="small text-muted-light d-block">SEND CRYPTO AMOUNT</span>
                                                    <span className="fw-bold text-white fs-5">{method.deposit_amount} {method.coin_symbol || method.coins?.symbol}</span>
                                                </div>
                                                <div>
                                                    <span className="small text-muted-light d-block">USD VALUE CREDITED</span>
                                                    <span className="fw-bold text-success fs-5">+${parseFloat(method.usd_credit).toLocaleString()} USD</span>
                                                </div>
                                                <div>
                                                    <span className="small text-muted-light d-block">WALLET DESTINATION ADDRESS</span>
                                                    <div className="d-flex align-items-center gap-2 mt-1">
                                                        <span className="font-monospace text-warning text-break p-2 rounded flex-grow-1" style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>{method.wallet_address}</span>
                                                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => {
                                                            navigator.clipboard.writeText(method.wallet_address);
                                                            if (window.Swal) window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Address copied', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
                                                        }}>
                                                            <i className="fa-regular fa-copy text-white"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Upload payment receipt proof */}
                                    <label className="small text-muted-light mb-2 fw-semibold">Upload Payment Proof Receipt (JPEG, PNG)</label>
                                    <input 
                                        type="file" 
                                        className="form-control form-control-premium w-100 mb-4"
                                        accept="image/*"
                                        onChange={e => setDepositProof(e.target.files[0])}
                                        required
                                    />

                                    <button 
                                        type="submit" 
                                        className="btn btn-success w-100 py-3 border-0 fw-bold"
                                        style={{ borderRadius: '12px' }}
                                        disabled={depositLoading}
                                    >
                                        {depositLoading ? <span className="spinner-border spinner-border-sm"></span> : "Submit Proof & Deposit"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: WITHDRAWAL USD --- */}
            {showWithdraw && (
                <div className="modal d-block animate-fade-in" tabIndex="-1" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 text-white p-4" style={{ borderRadius: '24px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold text-white">Request USD Bank Withdrawal</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowWithdraw(false); setWithdrawError(''); }}></button>
                            </div>

                            <form onSubmit={handleWithdrawalSubmit}>
                                <div className="modal-body py-4 d-flex flex-column gap-3">
                                    {withdrawError && (
                                        <div className="alert alert-danger border-0 text-white small p-2 mb-1" style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                                            <i className="fa-solid fa-circle-exclamation me-2"></i>{withdrawError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="small text-muted-light mb-1 fw-semibold">Select Destination Bank</label>
                                        <select 
                                            className="form-control form-control-premium w-100"
                                            value={withdrawBank}
                                            onChange={e => setWithdrawBank(e.target.value)}
                                            required
                                        >
                                            <option value="" style={{ background: '#1e293b' }}>-- Choose Bank --</option>
                                            {require('@/lib/banks').getBanksForCountry(user?.country || 'United States').map(bName => (
                                                <option key={bName} value={bName} style={{ background: '#1e293b' }}>{bName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="small text-muted-light mb-1 fw-semibold">Beneficiary Account Name</label>
                                        <input 
                                            type="text" 
                                            className="form-control form-control-premium w-100"
                                            placeholder="e.g. John Doe"
                                            value={withdrawAcctName}
                                            onChange={e => setWithdrawAcctName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="small text-muted-light mb-1 fw-semibold">
                                            {user?.country === 'United Kingdom' ? 'Sort Code / Account Number' :
                                             user?.country === 'Australia' ? 'BSB Code / Account Number (or PayID)' :
                                             user?.country === 'Canada' ? 'Transit / Institution Number / Account Number' :
                                             (user?.country === 'Germany' || user?.country === 'France') ? 'IBAN / BIC Code' :
                                             'Account Number / Routing Transit Number'}
                                        </label>
                                        <input 
                                            type="text" 
                                            className="form-control form-control-premium w-100 font-monospace"
                                            placeholder="Enter transfer codes & account details"
                                            value={withdrawAcctNum}
                                            onChange={e => setWithdrawAcctNum(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="small text-muted-light mb-1 fw-semibold">Withdrawal Amount (USD)</label>
                                        <div className="input-group">
                                            <span className="input-group-text input-group-text-premium">$</span>
                                            <input 
                                                type="number" 
                                                className="form-control form-control-premium input-group-premium-input font-monospace"
                                                placeholder="0.00"
                                                value={withdrawAmount}
                                                onChange={e => setWithdrawAmount(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>



                                    <button 
                                        type="submit" 
                                        className="btn btn-warning w-100 py-3 border-0 fw-bold mt-2 text-dark"
                                        style={{ borderRadius: '12px' }}
                                        disabled={withdrawLoading}
                                    >
                                        {withdrawLoading ? <span className="spinner-border spinner-border-sm"></span> : "Request Withdrawal"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
