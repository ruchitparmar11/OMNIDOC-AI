import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function SharedDocument({ sharedId, onGoDashboard }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchShared = async () => {
            try {
                const res = await axios.get(`${API_BASE}/shared/${sharedId}`);
                if (res.data.success) {
                    setData(res.data.data);
                } else {
                    setError('Document not found or private.');
                }
            } catch (err) {
                setError('Failed to load shared document.');
            } finally {
                setLoading(false);
            }
        };
        fetchShared();
    }, [sharedId]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Deep Dive...</div>
    if (error) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>{error}</div>

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={onGoDashboard}>
                <ArrowLeft size={16} /> Go to OMNIDOC
            </button>

            <div className="glass-panel" style={{ padding: '32px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <FileText size={24} color="var(--accent)" /> Public Deep Dive Analysis
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                    Document: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{data.file_name || 'Raw Text Content'}</span>
                </p>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', marginBottom: '32px' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>AI Executive Summary</h3>
                    <div className="markdown-wrapper" style={{ lineHeight: '1.6' }}>
                        <ReactMarkdown>{data.description}</ReactMarkdown>
                    </div>
                </div>

                <div>
                    <h3 style={{ marginBottom: '16px', color: 'var(--primary)' }}>AI Suggested Follow-ups</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                        {data.questions && data.questions.split('\n').filter(q => q.trim()).map((q, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
                                {q}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ textAlign: 'center', margin: '40px 0', padding: '24px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                <h3 style={{ marginBottom: '12px' }}>Want to interact with this document live?</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Sign up for OMNIDOC AI to talk to any file securely.</p>
                <button className="btn btn-primary" onClick={onGoDashboard}>Try OMNIDOC Free</button>
            </div>

        </div>
    );
}
