'use client';

import dynamic from 'next/dynamic';
import React, { useEffect } from 'react';

// Listen & Learn app is fully client-side — load dynamically to avoid SSR issues
const ListenLearnApp = dynamic(() => import('@/components/ListenLearnApp'), { ssr: false });

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: string | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(e: unknown) {
        return { error: String(e) };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        if (error.name === 'ChunkLoadError' || String(error).includes('ChunkLoadError')) {
            console.warn('[ErrorBoundary] ChunkLoadError caught! Redeploying via window.location.reload()');
            setTimeout(() => {
                if (typeof window !== 'undefined') window.location.reload();
            }, 500);
        }
    }
    render() {
        if (this.state.error) {
            // Auto reload on chunk load error
            if (this.state.error.includes('ChunkLoadError')) {
                return (
                    <div style={{ background: '#111', color: '#888', padding: 24, fontFamily: 'sans-serif', fontSize: 14, textAlign: 'center', position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #555', borderTopColor: '#fff', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                        <p>Đang tải bản cập nhật mới...</p>
                    </div>
                );
            }
            return (
                <div style={{ background: '#111', color: '#ff4444', padding: 24, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', position: 'fixed', inset: 0, zIndex: 99999, overflow: 'auto' }}>
                    <b>🔴 RUNTIME ERROR</b>{'\n\n'}{this.state.error}
                </div>
            );
        }
        return this.props.children;
    }
}

export default function HomePage() {
    useEffect(() => {
        const handleResourceError = (e: ErrorEvent) => {
            if (e.message && e.message.includes('ChunkLoadError')) {
                console.warn('[Window] ChunkLoadError caught! Reloading...');
                setTimeout(() => window.location.reload(), 500);
            }
        };
        window.addEventListener('error', handleResourceError);
        return () => window.removeEventListener('error', handleResourceError);
    }, []);

    return <ErrorBoundary><ListenLearnApp /></ErrorBoundary>;
}
