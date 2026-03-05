import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, FileText, ArrowLeft, Star } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function AdminPanel({ onBack }) {
    const [users, setUsers] = useState([]);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            const uRes = await axios.get(`${API_BASE}/admin/users`);
            const hRes = await axios.get(`${API_BASE}/admin/history`);
            if (uRes.data.success) setUsers(uRes.data.users);
            if (hRes.data.success) setHistory(hRes.data.history);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <button className="btn btn-outline" onClick={onBack}>
                    <ArrowLeft size={16} /> Back to Dashboard
                </button>
                <button className="btn btn-primary" onClick={() => window.open(`${API_BASE}/admin/export`, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} /> Export Users (CSV)
                </button>
            </div>

            <h1 className="text-gradient" style={{ marginBottom: '32px' }}>Admin Dashboard</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Users size={20} /> User Analytics
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {users.map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                <div>
                                    <span style={{ fontWeight: 600 }}>{u.username}</span>
                                    <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)' }}>{u.role}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Analyses: {u.analysis_count}</span>
                                    {u.is_premium ? <Star size={16} color="gold" /> : <div style={{ width: 16 }} />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <FileText size={20} /> Recent Site Activity
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {history.map(h => (
                            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '60%' }}>
                                    <span style={{ color: 'var(--primary)', marginRight: '8px' }}>@{h.user}</span>
                                    {h.file_name || 'Raw Text Analysis'}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
