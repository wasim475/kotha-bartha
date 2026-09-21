import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-base-100 p-6 shadow-md sm:p-10">
        {/* Header */}
        <div className="mb-10 border-b border-base-300 pb-6">
          <h1 className="text-3xl font-bold text-base-content sm:text-4xl">
            Privacy Policy
          </h1>

          <p className="mt-3 text-sm text-base-content/60">
            Last Updated: September 21, 2026
          </p>
        </div>

        {/* Introduction */}
        <section className="space-y-4">
          <p>
            Welcome to <strong>Kotha-Barta</strong> (“we,” “our,” “us,” or
            “the App”). We respect your privacy and are committed to
            protecting your personal information.
          </p>

          <p>
            This Privacy Policy explains what information we collect, how we
            use it, how we protect it, and what choices you have when using
            the kotha-Barta application and related services.
          </p>

          <p>
            By creating an account or using kotha-Barta, you agree to the
            practices described in this Privacy Policy.
          </p>
        </section>

        {/* 1 */}
        <PolicySection title="1. Information We Collect">
          <p>
            Depending on how you use the App, we may collect the following
            information.
          </p>

          <SubTitle>1.1 Account Information</SubTitle>

          <p>When you create an account, we may collect:</p>

          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Password (stored in protected/hashed form)</li>
            <li>Profile picture</li>
            <li>Bio or other profile information</li>
            <li>Account creation information</li>
          </ul>

          <p>
            If you sign in using a third-party authentication provider such as
            Google or Facebook, we may receive information provided by that
            provider, such as your name, email address, profile picture, and
            account identifier.
          </p>

          <SubTitle>1.2 User-Generated Content</SubTitle>

          <p>When you use kotha-Barta, you may voluntarily provide content such as:</p>

          <ul>
            <li>Posts</li>
            <li>Text messages</li>
            <li>Comments</li>
            <li>Replies</li>
            <li>Likes or reactions</li>
            <li>Profile information</li>
            <li>Images</li>
            <li>Videos</li>
            <li>Other content you choose to upload or share</li>
          </ul>

          <p>
            Content that you intentionally make public may be visible to other
            users of the App.
          </p>

          <SubTitle>1.3 Social and Communication Information</SubTitle>

          <p>
            To provide social and messaging features, we may process
            information about:
          </p>

          <ul>
            <li>Friend requests</li>
            <li>Friends and connections</li>
            <li>Messages</li>
            <li>Message delivery and read status</li>
            <li>Notifications</li>
            <li>Interaction with posts and comments</li>
            <li>User activity related to communication features</li>
          </ul>

          <SubTitle>1.4 Technical Information</SubTitle>

          <p>
            When you use the App, certain technical information may be
            collected automatically, including:
          </p>

          <ul>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Device type</li>
            <li>Operating system</li>
            <li>Approximate usage information</li>
            <li>Log and error information</li>
            <li>Authentication and session information</li>
          </ul>
        </PolicySection>

        {/* 2 */}
        <PolicySection title="2. How We Use Your Information">
          <p>We may use the information we collect to:</p>

          <ul>
            <li>Create and manage your account</li>
            <li>Authenticate users</li>
            <li>Provide login through Google or Facebook</li>
            <li>Provide messaging and social networking features</li>
            <li>Display your profile and user-generated content</li>
            <li>Process posts, comments, likes, and reactions</li>
            <li>Send notifications</li>
            <li>Process friend requests and connections</li>
            <li>Store and display uploaded media</li>
            <li>Maintain and improve the App</li>
            <li>Detect and prevent abuse, fraud, spam, and unauthorized access</li>
            <li>Troubleshoot technical problems</li>
            <li>Protect the security of users and our services</li>
            <li>Comply with applicable laws and legal obligations</li>
          </ul>
        </PolicySection>

        {/* 3 */}
        <PolicySection title="3. Publicly Shared Information">
          <p>
            Some information and content may be visible to other users
            depending on the features and privacy settings of the App.
          </p>

          <p>
            For example, if you publish a post, comment on a post, or make
            profile information available to other users, that information
            may be visible to them.
          </p>

          <p>
            Please do not share sensitive personal information publicly
            through your profile, posts, comments, or messages.
          </p>
        </PolicySection>

        {/* 4 */}
        <PolicySection title="4. Messages and Private Communications">
          <p>
            kotha-Barta provides private communication features between users.
          </p>

          <p>
            Messages may be processed and stored on our servers to provide
            messaging functionality, including message delivery,
            synchronization, notifications, and related features.
          </p>

          <p>
            Users should understand that no online communication system can
            be guaranteed to be completely secure.
          </p>

          <p>
            Please avoid sending highly sensitive information through the App.
          </p>
        </PolicySection>

        {/* 5 */}
        <PolicySection title="5. Third-Party Services">
          <p>
            We may use third-party services to provide certain functionality.
          </p>

          <SubTitle>Google</SubTitle>

          <p>
            If you choose to sign in using Google, Google may provide us with
            information necessary to authenticate your account.
          </p>

          <SubTitle>Facebook</SubTitle>

          <p>
            If you choose to sign in using Facebook, Facebook may provide us
            with information necessary to authenticate your account.
          </p>

          <SubTitle>Cloudinary</SubTitle>

          <p>
            We may use Cloudinary or similar third-party services to store and
            deliver uploaded images, videos, or other media.
          </p>

          <p>
            Third-party services may process information according to their
            own privacy policies and terms.
          </p>
        </PolicySection>

        {/* 6 */}
        <PolicySection title="6. Cookies and Authentication Technologies">
          <p>
            We may use cookies, tokens, local storage, or similar technologies
            to:
          </p>

          <ul>
            <li>Keep you signed in</li>
            <li>Maintain authentication sessions</li>
            <li>Protect accounts</li>
            <li>Remember certain preferences</li>
            <li>Provide core functionality of the App</li>
            <li>Improve security and performance</li>
          </ul>

          <p>
            You may be able to control cookies through your browser settings.
            Disabling certain technologies may affect some functionality of
            the App.
          </p>
        </PolicySection>

        {/* 7 */}
        <PolicySection title="7. Data Security">
          <p>
            We take reasonable technical and organizational measures to
            protect your information from unauthorized access, alteration,
            disclosure, or destruction.
          </p>

          <p>
            However, no method of transmission over the Internet or electronic
            storage is completely secure. Therefore, we cannot guarantee
            absolute security.
          </p>
        </PolicySection>

        {/* 8 */}
        <PolicySection title="8. Data Retention">
          <p>
            We retain personal information for as long as reasonably
            necessary to:
          </p>

          <ul>
            <li>Provide the App and its features</li>
            <li>Maintain user accounts</li>
            <li>Fulfill the purposes described in this Privacy Policy</li>
            <li>Resolve disputes</li>
            <li>Prevent abuse and fraud</li>
            <li>Comply with legal obligations</li>
          </ul>

          <p>
            When information is no longer reasonably required, we may delete
            or anonymize it, subject to applicable legal and operational
            requirements.
          </p>
        </PolicySection>

        {/* 9 */}
        <PolicySection title="9. Account and Data Deletion">
          <p>
            You may request deletion of your account and associated personal
            information.
          </p>

          <p>
            Depending on the nature of the information and applicable legal
            requirements, some information may need to be retained for
            legitimate purposes such as security, fraud prevention, dispute
            resolution, or legal compliance.
          </p>

          <p>
            To request account or data deletion, contact us using the contact
            information provided below.
          </p>
        </PolicySection>

        {/* 10 */}
        <PolicySection title="10. Children's Privacy">
          <p>
            kotha-Barta is not intended for children who are below the minimum
            age required by applicable law to use the service without
            parental consent.
          </p>

          <p>
            We do not knowingly collect personal information from children in
            violation of applicable laws.
          </p>

          <p>
            If you believe that a child has provided personal information to
            us without appropriate consent, please contact us so that we can
            take appropriate action.
          </p>
        </PolicySection>

        {/* 11 */}
        <PolicySection title="11. User Responsibilities">
          <p>
            You are responsible for the information and content that you
            choose to share through the App.
          </p>

          <p>You should:</p>

          <ul>
            <li>Keep your password confidential</li>
            <li>Avoid sharing sensitive personal information publicly</li>
            <li>
              Avoid sharing another person's private information without
              permission
            </li>
            <li>Report suspicious or abusive activity</li>
            <li>Use the App in accordance with applicable laws</li>
          </ul>
        </PolicySection>

        {/* 12 */}
        <PolicySection title="12. Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time.
          </p>

          <p>
            When we make significant changes, we may update the “Last
            Updated” date and, where appropriate, provide additional notice
            through the App.
          </p>

          <p>
            We encourage you to review this Privacy Policy periodically.
          </p>
        </PolicySection>

        {/* 13 */}
        <PolicySection title="13. Contact Us">
          <p>
            If you have questions, concerns, or requests regarding this
            Privacy Policy or your personal information, please contact us:
          </p>

          <div className="mt-4 rounded-xl bg-base-200 p-5">
            <p>
              <strong>App Name:</strong> kotha-Barta
            </p>

            <p className="mt-2">
              <strong>Email:</strong>{" "}
              <a
                href="mailto:YOUR_EMAIL@example.com"
                className="text-primary hover:underline"
              >
                wasim.hossain005@gmail.com
              </a>
            </p>
          </div>
        </PolicySection>

        {/* Footer */}
        <div className="mt-10 border-t border-base-300 pt-6 text-center text-sm text-base-content/60">
          <p>
            By using kotha-Barta, you acknowledge that you have read and
            understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Reusable Components
========================================================= */

function PolicySection({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-bold text-base-content sm:text-2xl">
        {title}
      </h2>

      <div className="space-y-4 leading-7 text-base-content/80">
        {children}
      </div>
    </section>
  );
}

function SubTitle({ children }) {
  return (
    <h3 className="pt-3 text-lg font-semibold text-base-content">
      {children}
    </h3>
  );
}
