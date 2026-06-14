'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [country, setCountry] = useState('United States');

    // Check if user is already logged in
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        if (data.user.role === 'admin') {
                            router.push(data.user.must_change_password === 1 ? '/admin/change-password' : '/admin');
                        } else {
                            router.push('/dashboard');
                        }
                    }
                }
            } catch (e) {
                // Not authenticated, do nothing
            }
        };
        checkAuth();
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Invalid credentials.');
            } else {
                setSuccess('Login successful!');
                setTimeout(() => {
                    if (data.user.role === 'admin') {
                        router.push(data.user.must_change_password === 1 ? '/admin/change-password' : '/admin');
                    } else {
                        router.push('/dashboard');
                    }
                }, 1000);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setLoading(false);
            return;
        }
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, confirmPassword, country })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Registration failed.');
            } else {
                setSuccess('Registration successful!');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 1000);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center p-0" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div className="card shadow-2xl border-0 overflow-hidden" style={{
                width: '1000px',
                maxWidth: '95%',
                borderRadius: '24px',
                background: 'rgba(30, 41, 59, 0.45)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
                <div className="row g-0 min-vh-50">
                    {/* Left Column: Premium Branding Graphic */}
                    <div className="col-lg-6 d-none d-lg-flex flex-column justify-content-between p-5 text-white position-relative" style={{
                        background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div>
                            <div className="d-flex align-items-center mb-4">
                                <img
                                    src="/pnd-logo.png"
                                    alt="PND Bank"
                                    style={{
                                        height: '52px',
                                        width: 'auto',
                                        objectFit: 'contain',
                                        filter: 'brightness(1.05)',
                                    }}
                                />
                            </div>
                            <h1 className="display-6 fw-bold lh-sm mb-3" style={{
                                background: 'linear-gradient(to right, #ffffff, #c084fc)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>
                                Future-Proof Online & Crypto Banking
                            </h1>
                            <p className="text-secondary fs-6 leading-relaxed">
                                Manage fiat assets and cryptocurrency balances in one unified bank account. Secure, instantaneous, and premium digital banking interface.
                            </p>
                        </div>

                        {/* Credit Card mockup */}
                        <div className="my-5 position-relative" style={{ perspective: '1000px' }}>
                            <div className="p-4 d-flex flex-column justify-content-between text-white" style={{
                                width: '320px',
                                height: '190px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                transform: 'rotateY(-10deg) rotateX(10deg)',
                                transformStyle: 'preserve-3d'
                            }}>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <div className="small opacity-50 mb-1">PND PREMIER</div>
                                        <div className="fw-semibold tracking-widest fs-5">DEBIT CARD</div>
                                    </div>
                                    <i className="fa-solid fa-wifi fs-4 opacity-50"></i>
                                </div>
                                <div className="my-3 text-start">
                                    <div className="fs-5 tracking-widest font-monospace">••••  ••••  ••••  8829</div>
                                </div>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="small opacity-50" style={{ fontSize: '10px' }}>ACCOUNT HOLDER</div>
                                        <div className="small tracking-wider fw-semibold">VALUED CUSTOMER</div>
                                    </div>
                                    <div className="d-flex gap-1">
                                        <div className="rounded-circle bg-danger opacity-75" style={{ width: '24px', height: '24px', marginRight: '-12px' }}></div>
                                        <div className="rounded-circle bg-warning opacity-75" style={{ width: '24px', height: '24px' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-3">
                            <span className="small opacity-50">Locked with AES-256 and SQL Transaction Isolation</span>
                            <i className="fa-solid fa-shield-halved text-success fs-5"></i>
                        </div>
                    </div>

                    {/* Right Column: Authentication Form */}
                    <div className="col-lg-6 d-flex flex-column justify-content-center p-5">
                        <div className="w-100 mx-auto" style={{ maxWidth: '400px' }}>
                            <div className="mb-4">
                                <h2 className="fw-bold text-white mb-2">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
                                <p className="text-secondary small">
                                    {isRegister ? 'Register your secure multi-currency account' : 'Enter credentials to access your banking platform'}
                                </p>
                            </div>

                            {/* Floating Alert Messages */}
                            {error && (
                                <div className="alert alert-danger border-0 text-white d-flex align-items-center gap-2 mb-4" style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}>
                                    <i className="fa-solid fa-circle-exclamation fs-5"></i>
                                    <span className="small">{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className="alert alert-success border-0 text-white d-flex align-items-center gap-2 mb-4" style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <i className="fa-solid fa-circle-check fs-5 text-success"></i>
                                    <span className="small">{success}</span>
                                </div>
                            )}

                            <form onSubmit={isRegister ? handleRegister : handleLogin} className="d-flex flex-column gap-3">
                                {isRegister && (
                                    <div className="form-group">
                                        <label className="text-secondary small mb-1 fw-semibold">Full Name</label>
                                        <div className="input-group">
                                            <span className="input-group-text border-0 text-secondary" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px 0 0 12px' }}>
                                                <i className="fa-solid fa-user"></i>
                                            </span>
                                            <input 
                                                type="text" 
                                                className="form-control border-0 text-white placeholder-secondary"
                                                style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0 12px 12px 0', padding: '12px' }}
                                                placeholder="John Doe" 
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="text-secondary small mb-1 fw-semibold">Email Address</label>
                                    <div className="input-group">
                                        <span className="input-group-text border-0 text-secondary" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px 0 0 12px' }}>
                                            <i className="fa-solid fa-envelope"></i>
                                        </span>
                                        <input 
                                            type="email" 
                                            className="form-control border-0 text-white placeholder-secondary"
                                            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0 12px 12px 0', padding: '12px' }}
                                            placeholder="john@example.com" 
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="text-secondary small mb-1 fw-semibold">Password</label>
                                    <div className="input-group">
                                        <span className="input-group-text border-0 text-secondary" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px 0 0 12px' }}>
                                            <i className="fa-solid fa-lock"></i>
                                        </span>
                                        <input 
                                            type="password" 
                                            className="form-control border-0 text-white placeholder-secondary"
                                            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0 12px 12px 0', padding: '12px' }}
                                            placeholder="••••••••" 
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {isRegister && (
                                    <>
                                        <div className="form-group">
                                            <label className="text-secondary small mb-1 fw-semibold">Confirm Password</label>
                                            <div className="input-group">
                                                <span className="input-group-text border-0 text-secondary" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px 0 0 12px' }}>
                                                    <i className="fa-solid fa-lock-open"></i>
                                                </span>
                                                <input 
                                                    type="password" 
                                                    className="form-control border-0 text-white placeholder-secondary"
                                                    style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '0 12px 12px 0', padding: '12px' }}
                                                    placeholder="••••••••" 
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="text-secondary small mb-1 fw-semibold">Country of Residence</label>
                                            <div className="input-group">
                                                <span className="input-group-text border-0 text-secondary" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px 0 0 12px' }}>
                                                    <i className="fa-solid fa-earth-americas"></i>
                                                </span>
                                                <select 
                                                    className="form-control border-0 text-white select-custom"
                                                    style={{ 
                                                        background: 'rgba(15, 23, 42, 0.9)', 
                                                        borderRadius: '0 12px 12px 0', 
                                                        padding: '12px',
                                                        color: '#ffffff'
                                                    }}
                                                    value={country}
                                                    onChange={e => setCountry(e.target.value)}
                                                    required
                                                >
                                                    {require('@/lib/countries').map(c => (
                                                        <option key={c.code} value={c.name} style={{ background: '#1e293b' }}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button 
                                    type="submit" 
                                    className="btn border-0 py-3 mt-3 fw-bold text-white d-flex align-items-center justify-content-center gap-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                        borderRadius: '12px',
                                        transition: 'transform 0.2s, opacity 0.2s',
                                        boxShadow: '0 10px 20px rgba(99, 102, 241, 0.25)'
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                        <>
                                            <span>{isRegister ? 'Register Account' : 'Log In'}</span>
                                            <i className="fa-solid fa-arrow-right-to-bracket fs-6"></i>
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="text-center mt-4 text-secondary small">
                                {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
                                <button 
                                    type="button" 
                                    className="btn btn-link p-0 text-indigo fw-semibold text-decoration-none"
                                    style={{ color: '#818cf8' }}
                                    onClick={() => {
                                        setIsRegister(!isRegister);
                                        setError('');
                                        setSuccess('');
                                    }}
                                >
                                    {isRegister ? 'Log In' : 'Register Here'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
