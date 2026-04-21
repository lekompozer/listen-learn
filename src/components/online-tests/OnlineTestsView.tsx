'use client';

/**
 * OnlineTestsView — embeds https://wynai.pro/online-test?view=community directly.
 * No need to rebuild the UI — the web page already has the full sidebar + marketplace.
 */

export default function OnlineTestsView() {
    return (
        <iframe
            src="https://wynai.pro/online-test?view=community"
            className="w-full h-full border-0"
            allow="autoplay; clipboard-write"
            title="Online Tests"
        />
    );
}
