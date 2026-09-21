
import React, { useState } from "react";

export default function DataDeletion() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email.trim()) return;

    // TODO:
    // এখানে তোমার backend API call করবে
    // যেমন:
    // await api.post("/auth/delete-account-request", { email });

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-base-100 p-6 shadow-md sm:p-10">
        {/* Header */}
        <div className="mb-8 border-b border-base-300 pb-6">
          <h1 className="text-3xl font-bold text-base-content sm:text-4xl">
            Data Deletion
          </h1>

          <p className="mt-3 text-sm text-base-content/60">
            Last Updated: September 21, 2026
          </p>
        </div>

        {/* Introduction */}
        <section className="space-y-4 leading-7 text-base-content/80">
          <p>
            At <strong>kotha-Barta</strong>, we respect your right to control
            your personal information.
          </p>

          <p>
            If you no longer want to use your kotha-Barta account, you may
            request deletion of your account and associated personal data.
          </p>
        </section>

        {/* What gets deleted */}
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">
            What Information May Be Deleted?
          </h2>

          <p className="mb-4 leading-7 text-base-content/80">
            Depending on your account and the information associated with it,
            account deletion may include:
          </p>

          <ul className="list-disc space-y-2 pl-6 leading-7 text-base-content/80">
            <li>Your account information</li>
            <li>Your name and profile information</li>
            <li>Your profile picture</li>
            <li>Your email address</li>
            <li>Your posts</li>
            <li>Your comments and replies</li>
            <li>Your likes and reactions</li>
            <li>Your friend connections</li>
            <li>Your friend requests</li>
            <li>Your messages and related communication data</li>
            <li>Uploaded media associated with your account</li>
          </ul>
        </section>

        {/* Third-party login */}
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">
            Third-Party Login
          </h2>

          <div className="space-y-4 leading-7 text-base-content/80">
            <p>
              If you created or accessed your account using Google or
              Facebook Login, requesting deletion through kotha-Barta will
              remove the information associated with your kotha-Barta account
              that we control.
            </p>

            <p>
              Deleting your kotha-Barta account does not necessarily delete
              information held by Google or Facebook. For information stored
              by those services, you should manage your data directly through
              the respective service.
            </p>
          </div>
        </section>

        {/* How to request */}
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">
            How to Request Data Deletion
          </h2>

          <p className="mb-6 leading-7 text-base-content/80">
            Enter the email address associated with your kotha-Barta account
            below and submit your deletion request.
          </p>

          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl bg-base-200 p-5 sm:p-6"
            >
              <label
                htmlFor="email"
                className="mb-2 block font-medium"
              >
                Account Email
              </label>

              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your account email"
                className="input input-bordered w-full"
              />

              <button
                type="submit"
                className="btn btn-error mt-4 w-full"
              >
                Request Data Deletion
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-5">
              <h3 className="text-lg font-semibold text-success">
                Request Submitted
              </h3>

              <p className="mt-2 leading-7 text-base-content/80">
                Your data deletion request has been received. We will review
                the request and take appropriate action.
              </p>
            </div>
          )}
        </section>

        {/* Important information */}
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">
            Important Information
          </h2>

          <div className="space-y-4 leading-7 text-base-content/80">
            <p>
              Before deleting your account, make sure you have saved any
              information or content that you want to keep.
            </p>

            <p>
              Some information may be retained where necessary for security,
              fraud prevention, dispute resolution, legal compliance, or
              other legitimate purposes.
            </p>

            <p>
              Data deletion may be permanent and cannot be undone once the
              deletion process has been completed.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold">
            Contact Us
          </h2>

          <div className="rounded-xl bg-base-200 p-5 leading-7">
            <p>
              If you have questions about data deletion, contact us at:
            </p>

            <p className="mt-3">
              <strong>Email:</strong>{" "}
              <a
                href="mailto:YOUR_EMAIL@example.com"
                className="text-primary hover:underline"
              >
                wasim.hossain005@gmail.com
              </a>
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-10 border-t border-base-300 pt-6 text-center text-sm text-base-content/60">
          <p>
            © {new Date().getFullYear()} kotha-Barta. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

