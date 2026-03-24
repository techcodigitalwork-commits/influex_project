"use client";

export default function PrivacyPolicy() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Plus Jakarta Sans',sans-serif}
        .pp{background:#f8fafc;min-height:100vh;font-family:'Plus Jakarta Sans',sans-serif}
        .pp-hero{background:linear-gradient(135deg,#0f172a,#1e293b);padding:60px 24px;text-align:center}
        .pp-hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#6ee7b7;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px;margin-bottom:20px;letter-spacing:0.05em}
        .pp-hero h1{font-size:36px;font-weight:800;color:#fff;margin-bottom:10px}
        @media(max-width:600px){.pp-hero h1{font-size:26px}}
        .pp-hero p{font-size:14px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto}
        .pp-body{max-width:800px;margin:0 auto;padding:40px 24px 80px}
        .pp-meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:32px;padding:16px 20px;background:#fff;border-radius:12px;border:1px solid #e2e8f0}
        .pp-meta-item{font-size:12px;color:#64748b;display:flex;align-items:center;gap:6px}
        .pp-meta-item strong{color:#111}
        .pp-intro{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;margin-bottom:16px}
        .pp-intro p{font-size:14px;color:#475569;line-height:1.8}
        .pp-section{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px;margin-bottom:16px}
        .pp-section-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:#f0fdf4;border-radius:10px;font-size:18px;margin-bottom:12px}
        .pp-section h2{font-size:18px;font-weight:700;color:#111;margin-bottom:12px;display:flex;align-items:center;gap:10px}
        .pp-section p{font-size:14px;color:#475569;line-height:1.8;margin-bottom:10px}
        .pp-section p:last-child{margin-bottom:0}
        .pp-section ul{list-style:none;padding:0;margin:10px 0}
        .pp-section ul li{font-size:14px;color:#475569;line-height:1.8;padding:4px 0 4px 20px;position:relative}
        .pp-section ul li::before{content:"✓";position:absolute;left:0;color:#16a34a;font-weight:700}
        .pp-highlight{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:12px;padding:16px 20px;margin-top:12px}
        .pp-highlight p{color:#15803d;font-weight:600;font-size:13px;margin:0}
        .pp-warn{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-top:12px}
        .pp-warn p{color:#92400e;font-weight:600;font-size:13px;margin:0}
        .pp-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
        .pp-table th{background:#f8fafc;padding:10px 14px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e2e8f0}
        .pp-table td{padding:10px 14px;color:#475569;border-bottom:1px solid #f1f5f9}
        .pp-table tr:last-child td{border-bottom:none}
        .pp-rights{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        @media(max-width:480px){.pp-rights{grid-template-columns:1fr}}
        .pp-right-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
        .pp-right-item h4{font-size:13px;font-weight:700;color:#111;margin-bottom:4px}
        .pp-right-item p{font-size:12px;color:#64748b;margin:0;line-height:1.5}
        .pp-contact{background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:28px;text-align:center;margin-top:24px}
        .pp-contact h3{color:#fff;font-size:18px;font-weight:700;margin-bottom:8px}
        .pp-contact p{color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:16px;line-height:1.6}
        .pp-contact a{color:#6ee7b7;text-decoration:none;font-weight:600}
        .pp-contact a:hover{color:#fff}
      `}</style>

      <div className="pp">
        <div className="pp-hero">
          <div className="pp-hero-badge">🔒 Privacy</div>
          <h1>Privacy Policy</h1>
          <p>Your privacy matters to us. Here's how we collect, use, and protect your data.</p>
        </div>

        <div className="pp-body">
          <div className="pp-meta">
            <div className="pp-meta-item">📅 <strong>Effective Date:</strong> March 24, 2026</div>
            <div className="pp-meta-item">🔄 <strong>Last Updated:</strong> March 24, 2026</div>
            <div className="pp-meta-item">🌏 <strong>Applicable To:</strong> All Collabzy Users</div>
          </div>

          <div className="pp-intro">
            <p>Collabzy ("we", "us", "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and share your data when you use our platform at collabzy.in. By using Collabzy, you agree to the practices described in this policy.</p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">📥</span> Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <table className="pp-table">
              <thead>
                <tr><th>Category</th><th>Data Collected</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Account Info</strong></td><td>Name, email address, password (encrypted), role (Brand/Creator)</td></tr>
                <tr><td><strong>Profile Info</strong></td><td>Profile photo, bio, location, phone number, Instagram/platform handle, follower count, categories</td></tr>
                <tr><td><strong>Campaign Data</strong></td><td>Campaign details, applications, proposals, bid amounts, deliverables</td></tr>
                <tr><td><strong>Payment Info</strong></td><td>Transaction amounts, payment status (card details are handled by Razorpay, not stored by us)</td></tr>
                <tr><td><strong>Messages</strong></td><td>In-platform chat messages between brands and creators</td></tr>
                <tr><td><strong>Usage Data</strong></td><td>Pages visited, features used, device type, IP address, browser info</td></tr>
                <tr><td><strong>Portfolio</strong></td><td>Reels and posts uploaded by creators for brand viewing</td></tr>
              </tbody>
            </table>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🎯</span> How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Create and manage your account</li>
              <li>Match creators with relevant brand campaigns</li>
              <li>Process payments and manage escrow transactions</li>
              <li>Enable communication between brands and creators</li>
              <li>Send platform notifications and updates</li>
              <li>Improve our platform features and user experience</li>
              <li>Detect and prevent fraud or policy violations</li>
              <li>Comply with legal obligations under Indian law</li>
            </ul>
            <div className="pp-highlight"><p>✅ We do NOT sell your personal data to advertisers or third parties.</p></div>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🤝</span> Information Sharing</h2>
            <p>We share your information only in these specific cases:</p>
            <ul>
              <li><strong>Between Brands & Creators:</strong> Profile info (name, followers, categories, portfolio) is shared to facilitate collaboration</li>
              <li><strong>Contact Details:</strong> Phone and Instagram handle are only revealed after a deal is completed</li>
              <li><strong>Payment Processors:</strong> Razorpay receives necessary data to process payments</li>
              <li><strong>Legal Requirements:</strong> If required by law, court order, or government authority</li>
              <li><strong>Business Transfer:</strong> In case of merger or acquisition, with notice to users</li>
            </ul>
            <div className="pp-warn"><p>⚠️ We never share your contact details (phone, Instagram) with brands until a deal is successfully completed.</p></div>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🍪</span> Cookies & Tracking</h2>
            <p>Collabzy uses cookies and similar technologies to:</p>
            <ul>
              <li>Keep you logged in across sessions</li>
              <li>Remember your preferences</li>
              <li>Analyze platform usage and performance</li>
              <li>Improve user experience</li>
            </ul>
            <p>You can control cookie settings through your browser. Disabling cookies may affect platform functionality.</p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🔐</span> Data Security</h2>
            <p>We take data security seriously. Our security measures include:</p>
            <ul>
              <li>SSL/TLS encryption for all data in transit</li>
              <li>Encrypted password storage using industry-standard hashing</li>
              <li>Secure payment processing via Razorpay (PCI-DSS compliant)</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls — only authorized personnel can access user data</li>
            </ul>
            <div className="pp-highlight"><p>🔒 Payment card details are never stored on Collabzy servers — all payments are handled securely by Razorpay.</p></div>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">⏳</span> Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. Specifically:</p>
            <ul>
              <li>Account data — retained until account deletion</li>
              <li>Transaction records — retained for 7 years (as required by Indian tax law)</li>
              <li>Chat messages — retained for 2 years after last activity</li>
              <li>Portfolio content — retained until deleted by user</li>
            </ul>
            <p>Upon account deletion, personal data is removed within 30 days, except where legal retention is required.</p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">⚖️</span> Your Rights</h2>
            <p>Under Indian data protection laws, you have the following rights:</p>
            <div className="pp-rights">
              <div className="pp-right-item"><h4>👁️ Right to Access</h4><p>Request a copy of all personal data we hold about you</p></div>
              <div className="pp-right-item"><h4>✏️ Right to Correct</h4><p>Update or correct inaccurate information in your profile</p></div>
              <div className="pp-right-item"><h4>🗑️ Right to Delete</h4><p>Request deletion of your account and associated data</p></div>
              <div className="pp-right-item"><h4>📦 Right to Portability</h4><p>Export your data in a machine-readable format</p></div>
              <div className="pp-right-item"><h4>🚫 Right to Object</h4><p>Object to processing of your data for marketing purposes</p></div>
              <div className="pp-right-item"><h4>⏸️ Right to Restrict</h4><p>Request restriction of processing in certain circumstances</p></div>
            </div>
            <p style={{marginTop:14}}>To exercise any of these rights, email us at <strong>privacy@collabzy.in</strong></p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">👶</span> Children's Privacy</h2>
            <p>Collabzy is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we discover that a minor has registered, we will immediately delete their account and associated data.</p>
            <p>If you believe a minor has created an account, please contact us at support@collabzy.in.</p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🌐</span> Third-Party Services</h2>
            <p>Collabzy integrates with the following third-party services, each with their own privacy policies:</p>
            <ul>
              <li><strong>Razorpay</strong> — Payment processing (razorpay.com/privacy)</li>
              <li><strong>Google Fonts</strong> — Typography rendering</li>
              <li><strong>Cloudinary</strong> — Media storage and delivery (when applicable)</li>
            </ul>
            <p>We are not responsible for the privacy practices of these third parties.</p>
          </div>

          <div className="pp-section">
            <h2><span className="pp-section-icon">🔔</span> Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by:</p>
            <ul>
              <li>Sending an email notification to your registered email</li>
              <li>Displaying a prominent notice on the platform</li>
              <li>Updating the "Last Updated" date at the top of this page</li>
            </ul>
            <p>Continued use of Collabzy after changes constitutes acceptance of the updated Privacy Policy.</p>
          </div>

          <div className="pp-contact">
            <h3>🔒 Privacy Questions?</h3>
            <p>If you have questions about this Privacy Policy or how we handle your data, our team is here to help.</p>
            <p>
              <a href="mailto:privacy@collabzy.in">📧 privacy@collabzy.in</a>
              <br /><br />
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>
                Collabzy · Indore, Madhya Pradesh, India
              </span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}