"use client";

export default function TermsOfService() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Plus Jakarta Sans',sans-serif}
        .tos{background:#f8fafc;min-height:100vh;font-family:'Plus Jakarta Sans',sans-serif}
        .tos-hero{background:linear-gradient(135deg,#0f0f1a,#1e1b38);padding:60px 24px;text-align:center}
        .tos-hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(79,70,229,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px;margin-bottom:20px;letter-spacing:0.05em}
        .tos-hero h1{font-size:36px;font-weight:800;color:#fff;margin-bottom:10px}
        @media(max-width:600px){.tos-hero h1{font-size:26px}}
        .tos-hero p{font-size:14px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto}
        .tos-body{max-width:800px;margin:0 auto;padding:40px 24px 80px}
        .tos-meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:32px;padding:16px 20px;background:#fff;border-radius:12px;border:1px solid #e2e8f0}
        .tos-meta-item{font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px}
        .tos-meta-item strong{color:#111}
        .tos-section{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;margin-bottom:16px}
        .tos-section-num{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;color:#fff;font-size:13px;font-weight:800;margin-bottom:12px;flex-shrink:0}
        .tos-section h2{font-size:18px;font-weight:700;color:#111;margin-bottom:12px;display:flex;align-items:center;gap:10px}
        .tos-section p{font-size:14px;color:#475569;line-height:1.8;margin-bottom:10px}
        .tos-section p:last-child{margin-bottom:0}
        .tos-section ul{list-style:none;padding:0;margin:10px 0}
        .tos-section ul li{font-size:14px;color:#475569;line-height:1.8;padding:4px 0 4px 20px;position:relative}
        .tos-section ul li::before{content:"→";position:absolute;left:0;color:#4f46e5;font-weight:700}
        .tos-highlight{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:12px;padding:16px 20px;margin-top:12px}
        .tos-highlight p{color:#4338ca;font-weight:600;font-size:13px;margin:0}
        .tos-contact{background:linear-gradient(135deg,#0f0f1a,#1e1b38);border-radius:16px;padding:28px;text-align:center;margin-top:24px}
        .tos-contact h3{color:#fff;font-size:18px;font-weight:700;margin-bottom:8px}
        .tos-contact p{color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:16px}
        .tos-contact a{color:#a5b4fc;text-decoration:none;font-weight:600}
        .tos-contact a:hover{color:#fff}
      `}</style>

      <div className="tos">
        <div className="tos-hero">
          <div className="tos-hero-badge">📋 Legal</div>
          <h1>Terms of Service</h1>
          <p>Please read these terms carefully before using Collabzy</p>
        </div>

        <div className="tos-body">
          <div className="tos-meta">
            <div className="tos-meta-item">📅 <strong>Effective Date:</strong> March 24, 2026</div>
            <div className="tos-meta-item">🔄 <strong>Last Updated:</strong> March 24, 2026</div>
            <div className="tos-meta-item">🌏 <strong>Jurisdiction:</strong> India</div>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">1</span> Acceptance of Terms</h2>
            <p>Welcome to Collabzy ("Platform", "we", "us", or "our"). By accessing or using our platform at collabzy.in, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our platform.</p>
            <p>These Terms apply to all users of the platform, including brands, influencers, creators, models, and photographers.</p>
            <div className="tos-highlight"><p>⚠️ By creating an account, you confirm that you are at least 18 years old and legally capable of entering into a binding agreement.</p></div>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">2</span> About Collabzy</h2>
            <p>Collabzy is India's influencer marketing platform that connects brands with creators — including influencers, models, photographers, and content creators — across India. We provide the tools for:</p>
            <ul>
              <li>Brands to post campaigns and discover creators</li>
              <li>Creators to apply for campaigns and showcase their portfolio</li>
              <li>Secure in-platform messaging and deal management</li>
              <li>Escrow-based payment processing via Razorpay</li>
              <li>Contract creation and management</li>
            </ul>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">3</span> User Accounts</h2>
            <p>To use Collabzy, you must create an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain the security of your password and account</li>
              <li>Not share your account credentials with any third party</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">4</span> Brand Responsibilities</h2>
            <p>As a Brand on Collabzy, you agree to:</p>
            <ul>
              <li>Post truthful and accurate campaign information</li>
              <li>Pay the agreed amount to creators upon work approval</li>
              <li>Review submitted work within a reasonable time</li>
              <li>Not misuse creator contact details obtained through the platform</li>
              <li>Comply with all applicable advertising regulations and ASCI guidelines</li>
              <li>Not conduct transactions outside the Collabzy platform to bypass fees</li>
            </ul>
            <div className="tos-highlight"><p>💡 Brands are solely responsible for the content of their campaigns and compliance with Indian advertising laws.</p></div>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">5</span> Creator Responsibilities</h2>
            <p>As a Creator (Influencer, Model, or Photographer) on Collabzy, you agree to:</p>
            <ul>
              <li>Provide accurate follower counts and profile information</li>
              <li>Deliver work as described in the accepted campaign</li>
              <li>Submit original content that you own or have the rights to</li>
              <li>Not misrepresent your reach, engagement, or identity</li>
              <li>Disclose paid partnerships as per ASCI guidelines (#ad, #sponsored)</li>
              <li>Not solicit brands for off-platform payments</li>
            </ul>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">6</span> Platform Fees & Payments</h2>
            <p>Collabzy charges a <strong>10% platform commission</strong> on all deals processed through the platform. This fee is deducted from the deal amount before releasing payment to the creator.</p>
            <ul>
              <li>All payments are processed through Razorpay</li>
              <li>Funds are held in escrow until the brand approves the delivered work</li>
              <li>Creators receive payment within 3-5 business days after approval</li>
              <li>Platform fees are non-refundable once a deal is initiated</li>
              <li>Subscription plans are billed monthly or annually as selected</li>
            </ul>
            <div className="tos-highlight"><p>🔒 All transactions on Collabzy are secured by Razorpay's PCI-DSS compliant payment infrastructure.</p></div>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">7</span> Prohibited Activities</h2>
            <p>The following activities are strictly prohibited on Collabzy:</p>
            <ul>
              <li>Sharing personal contact information (phone, WhatsApp, Instagram) in chat to bypass the platform</li>
              <li>Posting fake reviews, inflated follower counts, or misleading information</li>
              <li>Harassing, threatening, or abusing other users</li>
              <li>Uploading illegal, obscene, or defamatory content</li>
              <li>Attempting to hack, scrape, or interfere with the platform</li>
              <li>Creating multiple accounts to circumvent bans or limits</li>
              <li>Using the platform for spam, phishing, or fraudulent activities</li>
            </ul>
            <p>Violation of these rules may result in immediate account suspension without refund.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">8</span> Intellectual Property</h2>
            <p>All content on the Collabzy platform — including logos, design, code, and text — is owned by Collabzy and protected under Indian copyright law.</p>
            <p>Creators retain ownership of the content they create. By uploading content to the platform, you grant Collabzy a non-exclusive license to display it for platform purposes.</p>
            <p>Brands may use creator content only as agreed in the campaign terms. Unauthorized use of creator content is prohibited.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">9</span> Dispute Resolution</h2>
            <p>In case of disputes between brands and creators:</p>
            <ul>
              <li>First, attempt to resolve the issue through in-platform messaging</li>
              <li>If unresolved, contact Collabzy support at support@collabzy.in</li>
              <li>Collabzy may mediate disputes but is not responsible for final outcomes</li>
              <li>Escrow funds may be held pending dispute resolution</li>
            </ul>
            <p>All disputes are subject to the jurisdiction of courts in Indore, Madhya Pradesh, India.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">10</span> Limitation of Liability</h2>
            <p>Collabzy is a marketplace platform and is not responsible for:</p>
            <ul>
              <li>The quality or delivery of creator content</li>
              <li>Brand payments beyond escrow-held amounts</li>
              <li>Disputes arising from off-platform communications</li>
              <li>Any indirect, incidental, or consequential damages</li>
            </ul>
            <p>Our maximum liability is limited to the platform fees paid by you in the last 3 months.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">11</span> Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or platform notification. Continued use of the platform after changes constitutes acceptance of the new Terms.</p>
          </div>

          <div className="tos-section">
            <h2><span className="tos-section-num">12</span> Governing Law</h2>
            <p>These Terms are governed by the laws of India, including the Information Technology Act, 2000 and the Consumer Protection Act, 2019. Any disputes shall be subject to the exclusive jurisdiction of courts in Indore, Madhya Pradesh.</p>
          </div>

          <div className="tos-contact">
            <h3>Questions about our Terms?</h3>
            <p>If you have any questions or concerns about these Terms of Service, please contact us.</p>
            <a href="mailto:support@collabzy.in">📧 support@collabzy.in</a>
          </div>
        </div>
      </div>
    </>
  );
}