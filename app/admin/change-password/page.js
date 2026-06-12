'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminChangePasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const checkAuth = async () => {
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                router.push('/login');
                return;
            }
            const data = await res.json();
            if (data.user?.role !== 'admin') {
                router.push('/dashboard');
            }
        };
        checkAuth();
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword, confirmPassword })
            });
            const result = await res.json();
            if (!res.ok) {
                setError(result.error || "Update failed.");
            } else {
                setSuccess("Password updated successfully! Redirecting...");
                setTimeout(() => {
                    router.push('/admin');
                }, 1500);
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center" style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div className="card shadow-lg p-5 border-0 text-white" style={{
                width: '450px',
                borderRadius: '20px',
                background: 'rgba(30, 41, 59, 0.45)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.08)'
            }}>
                <div className="text-center mb-4">
                    <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{
                        width: '56px',
                        height: '56px',
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.3)'
                    }}>
                        <i className="fa-solid fa-key text-warning fs-4"></i>
                    </div>
                    <h3 className="fw-bold">Security Update Required</h3>
                    <p className="text-secondary small mt-1">First-time administrator login detected. Please establish a secure custom password before continuing.</p>
                </div>

                {error && (
                    <div className="alert alert-danger border-0 text-white small mb-3" style={{ background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
                        <i className="fa-solid fa-circle-exclamation me-2"></i>{error}
                    </div>
                )}
                {success && (
                    <div className="alert alert-success border-0 text-white small mb-3" style={{ background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px' }}>
                        <i className="fa-solid fa-circle-check me-2"></i>{success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                    <div className="form-group">
                        <label className="text-secondary small mb-1 fw-semibold">New Password</label>
                        <input 
                            type="password" 
                            className="form-control border-0 text-white bg-dark bg-opacity-50 py-3 px-3"
                            style={{ borderRadius: '10px' }}
                            placeholder="••••••••" 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="text-secondary small mb-1 fw-semibold">Confirm New Password</label>
                        <input 
                            type="password" 
                            className="form-control border-0 text-white bg-dark bg-opacity-50 py-3 px-3"
                            style={{ borderRadius: '10px' }}
                            placeholder="••••••••" 
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-warning py-3 fw-bold mt-3 text-dark d-flex align-items-center justify-content-center gap-2"
                        style={{ borderRadius: '10px' }}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner-border spinner-border-sm"></span> : <><span>Update Password</span><i className="fa-solid fa-lock-open"></i></>}
                    </button>
                </form>
            </div>
        </div>
    );
}
