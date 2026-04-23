import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/contexts/AppProviders';
import SelectionSpeakPopup from '@/components/SelectionSpeakPopup';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'WynAI Listen & Learn — Học Tiếng Anh Qua Bài Hát, Hội Thoại & Podcast',
    description:
        'Học tiếng Anh hiệu quả qua bài hát, từ vựng, hội thoại và podcast. AI hỗ trợ phát âm và ngữ pháp. Learn English through songs, conversations, and podcasts with AI assistance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="bg-[#06060f] text-white antialiased" suppressHydrationWarning>
                <AppProviders>
                    {children}
                    <SelectionSpeakPopup />
                    <Toaster
                        position="bottom-center"
                        toastOptions={{
                            style: {
                                background: '#1f2937',
                                color: '#f9fafb',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                fontSize: '14px',
                            },
                            success: { iconTheme: { primary: '#14b8a6', secondary: '#f9fafb' } },
                            error: { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
                        }}
                    />
                </AppProviders>
            </body>
        </html>
    );
}
