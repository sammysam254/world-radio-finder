export default function Terms() {
  const terms = [
    { title: "Acceptance of Terms", body: "By accessing or using Wavebox, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform." },
    { title: "Use of Service", body: "Wavebox provides access to publicly available radio stations and TV channels. You agree to use the service for lawful, personal, non-commercial purposes only." },
    { title: "Intellectual Property", body: "All branding, design, and original content on Wavebox is the property of Sam / Wavebox. Third-party streams belong to their respective owners." },
    { title: "No Warranties", body: "Wavebox is provided as-is without warranties of any kind. We do not guarantee uninterrupted access, stream quality, or availability of any station." },
    { title: "Limitation of Liability", body: "Wavebox and its developers shall not be liable for any direct, indirect, incidental, or consequential damages arising from use or inability to use the service." },
    { title: "Third-Party Content", body: "Wavebox aggregates streams from third-party providers. We are not responsible for the content, accuracy, or legality of third-party streams." },
    { title: "Advertising", body: "Wavebox may display advertisements. By using the service you consent to seeing ads. Advertisers are responsible for their own content." },
    { title: "Privacy", body: "Your use of Wavebox is also governed by our Privacy Policy. By using the service you consent to the data practices described therein." },
    { title: "Modifications", body: "We reserve the right to modify these terms at any time. Continued use of Wavebox after changes constitutes acceptance of the updated terms." },
    { title: "Termination", body: "We may suspend or terminate your access to Wavebox at our sole discretion, without notice, for conduct that violates these terms." },
    { title: "User Conduct", body: "You agree not to reverse-engineer, scrape excessively, or interfere with the operation of Wavebox or its underlying APIs." },
    { title: "Governing Law", body: "These terms are governed by the laws of Kenya. Any disputes shall be resolved in the courts of Nairobi, Kenya." },
    { title: "Contact", body: "For questions regarding these terms, contact us at +254706499848 or through the Wavebox platform." },
    { title: "Severability", body: "If any provision of these terms is found unenforceable, the remaining provisions shall continue in full force and effect." },
    { title: "Entire Agreement", body: "These Terms constitute the entire agreement between you and Wavebox regarding your use of the service, superseding all prior agreements." },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mt-1">Last updated: June 2025 · Wavebox by Sam</p>
        </div>
        <div className="flex flex-col gap-4">
          {terms.map((t, i) => (
            <div key={i} className="rounded-2xl border border-border/50 p-5" style={{background:"hsl(240 14% 9%)"}}>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{background:"var(--gradient-primary)"}}>{i+1}</span>
                <h2 className="font-bold text-sm">{t.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8 flex items-center justify-center gap-4 text-sm">
          <a href="/" className="text-primary underline">← Back to Wavebox</a>
          <span className="text-muted-foreground">·</span>
          <a href="/privacy" className="text-primary underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
