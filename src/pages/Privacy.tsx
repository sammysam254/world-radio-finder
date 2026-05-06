export default function Privacy() {
  const policies = [
    { title: "Information We Collect", body: "We collect minimal information needed to operate the service, including stream play events and anonymous usage analytics. No personal data is required to use Wavebox." },
    { title: "Local Storage", body: "Wavebox stores your preferences such as volume, last station, and ad progress in your browser's local storage. This data never leaves your device." },
    { title: "Analytics", body: "We use anonymous analytics to understand how users interact with Wavebox. No personally identifiable information is collected in this process." },
    { title: "Third-Party APIs", body: "Wavebox connects to Radio Browser API and IPTV-org to fetch station data. These third parties have their own privacy policies governing their data practices." },
    { title: "Advertising", body: "Ads displayed on Wavebox may use cookies or tracking pixels from ad providers including Monetag. These are governed by the respective ad provider's privacy policy." },
    { title: "Cookies", body: "Wavebox itself does not set tracking cookies. Embedded ad content and third-party players may set their own cookies as described in their policies." },
    { title: "Data Sharing", body: "We do not sell, trade, or rent your personal information to third parties. Aggregate anonymous data may be used to improve the service." },
    { title: "Data Security", body: "We implement reasonable technical measures to protect your data. However, no internet transmission is 100% secure and we cannot guarantee absolute security." },
    { title: "Children's Privacy", body: "Wavebox is not directed at children under 13. We do not knowingly collect personal information from children under 13 years of age." },
    { title: "Stream Providers", body: "Radio and TV streams are hosted by third-party providers. Wavebox is not responsible for the privacy practices of those stream providers." },
    { title: "Your Rights", body: "You have the right to access, correct, or delete any personal data we hold. Contact us at +254706499848 to exercise these rights." },
    { title: "Data Retention", body: "Anonymous usage data is retained for up to 12 months for analytics. Locally stored preferences are retained until you clear your browser data." },
    { title: "Changes to Policy", body: "We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the date at the top of this page." },
    { title: "International Users", body: "Wavebox is operated from Kenya. If you access the service from outside Kenya, your data may be transferred to and processed in Kenya." },
    { title: "Contact Us", body: "If you have questions about this Privacy Policy, contact us at +254706499848 or through the Wavebox platform." },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mt-1">Last updated: June 2025 · Wavebox by Sam</p>
        </div>
        <div className="flex flex-col gap-4">
          {policies.map((p, i) => (
            <div key={i} className="rounded-2xl border border-border/50 p-5" style={{background:"hsl(240 14% 9%)"}}>
              <div className="flex items-center gap-3 mb-2">
                <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{background:"var(--gradient-primary)"}}>{i+1}</span>
                <h2 className="font-bold text-sm">{p.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8 flex items-center justify-center gap-4 text-sm">
          <a href="/" className="text-primary underline">← Back to Wavebox</a>
          <span className="text-muted-foreground">·</span>
          <a href="/terms" className="text-primary underline">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
