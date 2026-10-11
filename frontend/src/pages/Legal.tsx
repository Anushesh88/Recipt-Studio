import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/brand/Logo";

// /privacy and /terms: public pages (no sign-in needed), linked from the login
// page and Google's sign-in screen. They describe what the app actually does;
// keep them in step with it.

const CONTACT_EMAIL = "anusheshjumale88@gmail.com";
const EFFECTIVE = "11 October 2026";

const Mail: React.FC = () => <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-700 underline">{CONTACT_EMAIL}</a>;

const LegalPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-gray-50">
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link to="/" aria-label="Receipt Studio home"><Logo className="mb-6" /></Link>
      <article className="space-y-4 rounded-lg border border-border bg-white p-6 text-sm leading-relaxed text-gray-800 sm:p-8 [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-muted-foreground">Effective {EFFECTIVE}</p>
        {children}
      </article>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link> · <Link to="/terms" className="hover:underline">Terms of Service</Link>
      </p>
    </div>
  </div>
);

export const PrivacyPolicy: React.FC = () => (
  <LegalPage title="Privacy Policy">
    <p>
      Receipt Studio ("we") lets you design receipts and GST tax invoices and issue them to your customers. This policy
      explains what we store, why, and what you can ask us to do with it. Questions: <Mail />.
    </p>

    <h2>What we store</h2>
    <ul>
      <li><strong>Your account:</strong> your email address and your password, stored only as a one-way hash. If you sign in
        with Google, we receive your email address and Google's account ID for you; we don't store your name, photo or contacts.</li>
      <li><strong>Your business details:</strong> what you enter in Settings, such as business name, address, GSTIN and
        numbering preferences.</li>
      <li><strong>What you create:</strong> templates, uploaded logos and signatures, and the receipts and invoices you issue,
        including the customer details and items you type into them (for example a customer's name, address, email or GSTIN).</li>
      <li><strong>Saved customers and items:</strong> remembered from your receipts so the form can fill them in next time.
        You can delete them in Settings.</li>
    </ul>

    <h2>Why</h2>
    <p>
      Only to run the service for you: to sign you in, show and fill in your templates, number and calculate your receipts,
      make PDFs, and show your history and sales reports. We don't sell your data, show ads, or use advertising or analytics trackers.
    </p>

    <h2>Your customers' details</h2>
    <p>
      When you enter details about your customers, you decide what goes in and you're responsible for having the right to use
      them. We store and process them only on your behalf, to make your receipts.
    </p>

    <h2>Receipt links you share</h2>
    <p>
      The WhatsApp button creates a private link to one receipt's PDF. Anyone who has that link can open that receipt without
      signing in, so share it only with the right person. The message itself is sent by you through WhatsApp, under WhatsApp's own terms.
    </p>

    <h2>Where it's kept, and who helps us</h2>
    <ul>
      <li><strong>Neon</strong> hosts the database (servers in Singapore).</li>
      <li><strong>Render</strong> runs the app's server (Singapore). It keeps a temporary copy of generated PDFs.</li>
      <li><strong>Cloudflare</strong> delivers the website to your browser.</li>
      <li><strong>Google</strong> handles "Sign in with Google", only if you use it.</li>
    </ul>
    <p>Data travels between your browser and these services over encrypted (HTTPS) connections.</p>

    <h2>In your browser</h2>
    <p>
      We keep your sign-in token in your browser's local storage so you stay signed in. We don't set advertising or tracking
      cookies. Google's sign-in button may set its own cookies when you use it.
    </p>

    <h2>How long we keep it, and your choices</h2>
    <p>
      We keep your data while you have an account. You can ask us to send you a copy, correct it, or delete your account and
      everything in it by emailing <Mail /> from the address you signed up with. We'll do it within 30 days. Copies in short-term
      backups disappear as those backups expire.
    </p>

    <h2>Security</h2>
    <p>
      We protect your data with hashed passwords, encrypted connections and per-account access checks. No online service can
      promise perfect security; if we learn of a breach affecting you, we'll tell you.
    </p>

    <h2>Children</h2>
    <p>Receipt Studio is for businesses and isn't meant for anyone under 18.</p>

    <h2>Changes</h2>
    <p>If we change this policy, we'll update the date above, and tell you in the app or by email if the change is significant.</p>
  </LegalPage>
);

export const TermsOfService: React.FC = () => (
  <LegalPage title="Terms of Service">
    <p>By creating an account or using Receipt Studio, you agree to these terms. Questions: <Mail />.</p>

    <h2>The service</h2>
    <p>
      Receipt Studio is currently free and in an early (beta) stage. Features may change, and we may pause or stop the service.
      We'll try to give notice so you can download your receipts first. The free servers may take a minute to start after a
      quiet period.
    </p>

    <h2>Your account</h2>
    <p>
      Keep your password safe and tell us if you think someone else has used your account. You're responsible for what's done
      with it. One person or business per account.
    </p>

    <h2>Your invoices and taxes</h2>
    <p>
      Receipt Studio helps you lay out receipts and GST invoices and does the calculations, but <strong>you're responsible for
      what you issue</strong>: the details, tax rates, HSN/SAC codes, numbering and filing. The app isn't tax or legal advice;
      check with your chartered accountant. It doesn't cover e-invoicing (IRN) and some other cases; see the in-app notes.
    </p>

    <h2>Acceptable use</h2>
    <ul>
      <li>Use it only for genuine, lawful business documents. No fake, misleading or fraudulent receipts or invoices.</li>
      <li>Only enter other people's details when you're allowed to.</li>
      <li>Don't try to break, overload or get around the security of the service, or access other people's accounts.</li>
    </ul>
    <p>We may suspend accounts that break these rules.</p>

    <h2>Your content</h2>
    <p>
      Your templates, logos, receipts and data stay yours. You let us store and process them only to provide the service to
      you. Receipts made here carry a small "Made with Receipt Studio" line.
    </p>

    <h2>No warranty, limited liability</h2>
    <p>
      The service is provided "as is", without warranties. To the extent the law allows, we aren't liable for indirect losses,
      lost profits, or problems caused by errors in documents you issue, and our total liability is limited to the amount you
      paid us in the last 12 months (currently nothing, as the service is free).
    </p>

    <h2>Ending</h2>
    <p>You can stop using the service and ask us to delete your account at any time (see the Privacy Policy).</p>

    <h2>Law</h2>
    <p>These terms are governed by the laws of India.</p>

    <h2>Changes</h2>
    <p>We may update these terms; we'll change the date above and tell you if the change is significant.</p>
  </LegalPage>
);
