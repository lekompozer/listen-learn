import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | Listen & Learn',
    description:
        'Privacy Policy for WynAI Listen & Learn in Vietnamese and English.',
};

const viSections = [
    {
        title: '1. Phạm vi áp dụng',
        body: [
            'Chính sách này áp dụng cho ứng dụng WynAI Listen & Learn trên desktop, web và các nền tảng phân phối ứng dụng liên quan.',
            'Khi bạn sử dụng ứng dụng, đăng ký tài khoản, kích hoạt gói dịch vụ hoặc tải dữ liệu lên hệ thống, bạn đồng ý với việc xử lý dữ liệu theo chính sách này.',
        ],
    },
    {
        title: '2. Dữ liệu chúng tôi có thể thu thập',
        body: [
            'Thông tin tài khoản: email, tên hiển thị, mã định danh người dùng và trạng thái gói dịch vụ.',
            'Dữ liệu sử dụng: lịch sử học tập, tiến độ, từ đã lưu, dữ liệu hội thoại, lựa chọn gói, thiết bị và nhật ký kỹ thuật cần thiết để vận hành dịch vụ.',
            'Dữ liệu nội dung do người dùng cung cấp: file đọc, văn bản, audio ghi âm, câu hỏi, đường link hoặc nội dung khác mà bạn chủ động nhập vào ứng dụng.',
            'Một phần dữ liệu có thể được lưu cục bộ trên thiết bị để hỗ trợ trải nghiệm cá nhân hóa và hoạt động offline.',
        ],
    },
    {
        title: '3. Mục đích sử dụng dữ liệu',
        body: [
            'Cung cấp tính năng học tiếng Anh, đồng bộ dữ liệu giữa các thiết bị, xác thực tài khoản, xử lý thanh toán hoặc kích hoạt key hợp lệ.',
            'Cải thiện chất lượng ứng dụng, bảo mật hệ thống, phát hiện lỗi, ngăn chặn lạm dụng và tuân thủ yêu cầu pháp lý hoặc yêu cầu của các nền tảng phân phối.',
        ],
    },
    {
        title: '4. Dịch vụ bên thứ ba',
        body: [
            'Ứng dụng có thể sử dụng các dịch vụ bên thứ ba như Firebase, hệ thống thanh toán, nhà cung cấp AI, dịch vụ speech-to-text, text-to-speech, analytics hoặc hạ tầng lưu trữ để vận hành một số tính năng.',
            'Các dịch vụ đó có thể xử lý dữ liệu trong phạm vi cần thiết để cung cấp chức năng tương ứng.',
        ],
    },
    {
        title: '5. Quyền sở hữu trí tuệ và tuân thủ bản quyền',
        body: [
            'Người dùng chịu trách nhiệm bảo đảm rằng mọi file, đường link, audio, văn bản, hình ảnh hoặc dữ liệu khác mà mình đưa vào ứng dụng đều có quyền sử dụng hợp pháp.',
            'Mọi dữ liệu người dùng phải tuân thủ luật bản quyền, giấy phép nội dung, điều khoản nền tảng và các quy định pháp luật hiện hành.',
            'Chúng tôi có quyền xóa, vô hiệu hóa, chặn truy cập hoặc gỡ bỏ bất kỳ đường link, dữ liệu, nội dung hoặc tài nguyên nào bị nghi ngờ vi phạm bản quyền, vi phạm giấy phép, vi phạm điều khoản sử dụng hoặc tạo rủi ro pháp lý, mà không cần thông báo trước.',
            'Việc gỡ bỏ này có thể được thực hiện để đáp ứng yêu cầu của chủ sở hữu quyền, cơ quan có thẩm quyền, đối tác hạ tầng hoặc điều kiện của các app store và nền tảng phân phối.',
        ],
    },
    {
        title: '6. Lưu trữ và bảo mật',
        body: [
            'Chúng tôi áp dụng các biện pháp kỹ thuật hợp lý để bảo vệ dữ liệu khỏi truy cập trái phép, mất mát hoặc lạm dụng.',
            'Tuy nhiên, không có hệ thống nào đảm bảo an toàn tuyệt đối. Bạn nên bảo mật thiết bị, tài khoản và thông tin đăng nhập của mình.',
        ],
    },
    {
        title: '7. Quyền của người dùng',
        body: [
            'Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu tài khoản trong phạm vi pháp luật cho phép và trong khả năng kỹ thuật của dịch vụ.',
            'Bạn cũng có thể ngừng sử dụng ứng dụng bất kỳ lúc nào; một số dữ liệu sao lưu, nhật ký kỹ thuật hoặc dữ liệu cần thiết cho nghĩa vụ pháp lý có thể vẫn được lưu trong một khoảng thời gian hợp lý.',
        ],
    },
    {
        title: '8. Liên hệ',
        body: [
            'Nếu bạn có câu hỏi về quyền riêng tư, bản quyền hoặc yêu cầu gỡ bỏ dữ liệu, vui lòng liên hệ: hello@wynai.pro',
        ],
    },
];

const enSections = [
    {
        title: '1. Scope',
        body: [
            'This policy applies to the WynAI Listen & Learn application on desktop, web, and related distribution platforms.',
            'By using the app, registering an account, activating a plan, or uploading content, you agree to the data practices described in this policy.',
        ],
    },
    {
        title: '2. Data We May Collect',
        body: [
            'Account information such as email address, display name, user identifier, and subscription status.',
            'Usage data such as learning history, progress, saved vocabulary, conversation history, plan selections, device information, and technical logs required to operate the service.',
            'User-provided content such as reading files, text, recorded audio, prompts, links, and other content you choose to submit to the app.',
            'Some data may be stored locally on your device to support personalization and offline functionality.',
        ],
    },
    {
        title: '3. How We Use Data',
        body: [
            'To provide English-learning features, sync data across devices, authenticate users, process payments, and activate valid keys or subscriptions.',
            'To improve app quality, secure the service, diagnose issues, prevent abuse, and comply with legal or platform requirements.',
        ],
    },
    {
        title: '4. Third-Party Services',
        body: [
            'The app may use third-party services such as Firebase, payment providers, AI providers, speech-to-text services, text-to-speech services, analytics tools, and storage infrastructure to operate certain features.',
            'Those services may process data only as needed to provide the relevant functionality.',
        ],
    },
    {
        title: '5. Copyright Compliance and Content Enforcement',
        body: [
            'Users are responsible for ensuring that any files, links, audio, text, images, or other content submitted through the app are lawful and properly licensed.',
            'All user data and submitted content must comply with copyright law, content licenses, platform terms, and applicable regulations.',
            'We may remove, disable access to, block, or delete any link, data, content, or resource suspected of infringing copyright, violating licensing terms, breaching platform rules, or creating legal risk, without prior notice.',
            'Such action may be taken to comply with requests from rights holders, legal authorities, infrastructure providers, or app store and platform requirements.',
        ],
    },
    {
        title: '6. Storage and Security',
        body: [
            'We use reasonable technical measures to protect data against unauthorized access, loss, or misuse.',
            'No system is completely secure, and you are responsible for protecting your device, account, and login credentials.',
        ],
    },
    {
        title: '7. User Rights',
        body: [
            'You may request access, correction, or deletion of your account data to the extent permitted by law and technically feasible for the service.',
            'You may stop using the app at any time, but some backup data, technical logs, or data retained for legal compliance may remain for a reasonable period.',
        ],
    },
    {
        title: '8. Contact',
        body: [
            'For privacy, copyright, or takedown requests, contact: hello@wynai.pro',
        ],
    },
];

function SectionList({ sections }: { sections: { title: string; body: string[] }[] }) {
    return (
        <div className="space-y-6">
            {sections.map((section) => (
                <section key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-white">{section.title}</h2>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-gray-300">
                        {section.body.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.16),transparent_28%),linear-gradient(180deg,#050816_0%,#0b1220_48%,#0a0f19_100%)] text-white">
            <div className="mx-auto max-w-6xl px-6 py-16">
                <div className="rounded-[32px] border border-white/10 bg-black/30 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-teal-200">
                            Privacy Policy
                        </div>
                        <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">WynAI Listen & Learn</h1>
                        <p className="mt-4 text-base leading-7 text-gray-300">
                            Chính sách quyền riêng tư song ngữ cho ứng dụng Listen & Learn. Trang này được dùng làm URL chính sách quyền riêng tư khi phân phối ứng dụng trên các store và nền tảng tải xuống.
                        </p>
                        <p className="mt-3 text-base leading-7 text-gray-400">
                            This bilingual privacy policy is intended for store submission, app distribution, and public disclosure requirements.
                        </p>
                        <p className="mt-6 text-sm text-gray-500">Effective date: April 26, 2026</p>
                    </div>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-2">
                    <div>
                        <div className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-teal-200">Tiếng Việt</div>
                        <SectionList sections={viSections} />
                    </div>
                    <div>
                        <div className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">English</div>
                        <SectionList sections={enSections} />
                    </div>
                </div>
            </div>
        </main>
    );
}