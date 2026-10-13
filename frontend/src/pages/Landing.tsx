import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, Check, FileCheck2, IndianRupee, MessageCircle, Palette, Smartphone, Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "../components/brand/Logo";
import { ReceiptPreview } from "../components/preview/ReceiptPreview";
import { useElementWidth } from "../components/generate/useElementWidth";
import { starterValues, SAMPLE_NUMBERS } from "../components/templates/starterPreview";
import { previewFromForm } from "../components/generate/formModel";
import { STARTER_TEMPLATES, type StarterTemplate } from "../lib/starterTemplates";
import { CONTACT_EMAIL } from "./Legal";

// The site root for visitors: what Receipt Studio is, a live demo bill, real
// sample templates and "Start free". Everything shown is the real renderer.

const SIGN_UP = "/login?mode=signup";
const YEAR = new Date().getFullYear();
const starter = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!;

// The café bill filling itself in, line by line, then "sent"
const DEMO_STEP_MS = 1600;
const DemoBill: React.FC = () => {
  const cafe = starter("cafe-receipt");
  const base = useMemo(() => starterValues(cafe), [cafe]);
  const steps = base.values.items.length + 2; // empty, each item, then sent
  // Without motion, the finished bill stays put
  const [still] = useState(() => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const [step, setStep] = useState(still ? steps - 1 : 1);
  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % steps), DEMO_STEP_MS);
    return () => clearInterval(timer);
  }, [steps, still]);

  const shown = Math.min(step, base.values.items.length);
  const preview = useMemo(() => {
    const values = { ...base.values, items: base.values.items.slice(0, Math.max(shown, 1)) };
    if (shown === 0) values.items = [{ ...values.items[0], description: "", unit_price: "" }];
    return previewFromForm(values, SAMPLE_NUMBERS.receipt, false, base.account);
  }, [base, shown]);
  const sent = step === steps - 1;

  return (
    <div className="relative mx-auto w-fit" aria-label="A café bill being filled in" role="img">
      <div className="rounded-xl bg-white p-3 shadow-xl ring-1 ring-black/5">
        <ReceiptPreview canvas={cafe.canvas} scale={0.9} {...preview} />
      </div>
      <div
        className={`absolute -right-3 bottom-16 flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white shadow-lg transition-all duration-500 sm:-right-10 ${sent ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
        aria-hidden="true"
      >
        <MessageCircle className="size-4" />
        Sent on WhatsApp
      </div>
    </div>
  );
};

// A ready-made template with its sample business, scaled to fit
const Sample: React.FC<{ template: StarterTemplate }> = ({ template }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const preview = useMemo(() => {
    const { model, values, account } = starterValues(template);
    return previewFromForm(values, SAMPLE_NUMBERS[template.canvas.documentType], model.gst, account);
  }, [template]);
  const scale = width > 0 ? Math.min(1, width / template.canvas.page.width) : 0;
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div ref={ref} className="pointer-events-none relative h-72 overflow-hidden bg-gray-100" aria-hidden="true">
        {scale > 0 && (
          <div className="flex justify-center">
            <ReceiptPreview canvas={template.canvas} scale={scale} {...preview} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-100 to-transparent" />
      </div>
      <figcaption className="p-3">
        <span className="block font-medium">{template.name}</span>
        <span className="block text-sm text-muted-foreground">{template.business}</span>
      </figcaption>
    </figure>
  );
};

const FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <FileCheck2 />, title: "GST invoices done right", body: "CGST + SGST or IGST worked out for you, invoice numbers that restart each financial year, and a check for every detail a tax invoice must show." },
  { icon: <IndianRupee />, title: "Get paid by UPI", body: "A QR code on the bill with the exact amount filled in. Customers scan, and their UPI app is ready to pay." },
  { icon: <MessageCircle />, title: "Send on WhatsApp", body: "Send the bill as a PDF, an image or a link, straight from your phone." },
  { icon: <Palette />, title: "Your brand, everywhere", body: "Add your logo, colour and fonts once. Every template takes them on, and you can design your own like in Canva." },
  { icon: <BarChart3 />, title: "Know what sold", body: "A sales report for any period: how much of each item, total sales and tax." },
  { icon: <Smartphone />, title: "Works on your phone", body: "Make a bill at the counter in under a minute. Nothing to install." },
];

const COMPARISON: { label: string; us: boolean; excel: boolean; canva: boolean; apps: boolean }[] = [
  { label: "Looks like your brand", us: true, excel: false, canva: true, apps: false },
  { label: "Does the maths and GST", us: true, excel: false, canva: false, apps: true },
  { label: "Numbers every bill", us: true, excel: false, canva: false, apps: true },
  { label: "UPI QR with the amount", us: true, excel: false, canva: false, apps: true },
  { label: "Quick on a phone", us: true, excel: false, canva: false, apps: true },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Is it free?", a: "Yes. Receipt Studio is free while we're in early access, with no card needed. If we ever add paid plans, what you've made stays yours and we'll tell you well in advance." },
  { q: "I'm not GST-registered. Can I use it?", a: "Yes. Make simple receipts and bills without any GST. If you register later, switch to GST tax invoices in Settings." },
  { q: "Do my customers need the app?", a: "No. They get a normal PDF or image on WhatsApp, and can pay by scanning the UPI QR with any UPI app." },
  { q: "Can I use my own design?", a: "Yes. Start from one of 20 ready-made templates or a blank page, and move, restyle or add anything: text, your logo, tables, QR codes and signatures." },
  { q: "Is my data safe?", a: "Your bills are private to your account and sent over an encrypted connection. Read the Privacy Policy for what we keep and why." },
];

const Tick: React.FC<{ on: boolean; label: string }> = ({ on, label }) =>
  on ? <Check className="mx-auto size-5 text-emerald-600" aria-label={`${label}: yes`} /> : <X className="mx-auto size-5 text-gray-300" aria-label={`${label}: no`} />;

export const Landing: React.FC = () => {
  const samples = ["salon-receipt", "gst-a4", "bakery-receipt", "gst-pharmacy", "freelance-receipt", "gst-thermal"].map(starter);
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
            <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to={SIGN_UP}>Start free</Link></Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-indigo-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2">
            <div>
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                <Sparkles className="size-3.5" /> For shops, cafés, clinics and freelancers in India
              </p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Beautiful bills and GST invoices, <span className="text-indigo-700">in seconds.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-gray-600">
                Design your bill once, the way you like it. Then fill in the items and send it on WhatsApp, with a UPI QR for the exact amount.
                The maths, numbering and GST are done for you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to={SIGN_UP}>Start free</Link></Button>
                <Button asChild size="lg" variant="outline"><a href="#samples">See sample bills</a></Button>
              </div>
              <p className="mt-3 text-sm text-gray-500">Free while in early access · No card needed · Sign up with Google in one tap</p>
            </div>
            <DemoBill />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-center text-2xl font-bold sm:text-3xl">Your first bill in under 3 minutes</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Pick a template", "20 ready-made designs for shops, cafés, clinics, tuition, rent and GST invoices. Your logo and colour are added for you."],
              ["Fill in the bill", "Type the items. Totals, tax and the bill number fill themselves in. Saved customers and items come back as you type."],
              ["Send and get paid", "Send the PDF on WhatsApp. The customer scans the UPI QR and pays the exact amount."],
            ].map(([title, body], i) => (
              <li key={title} className="rounded-lg border border-border p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="samples" className="scroll-mt-16 bg-gray-50 py-14" aria-labelledby="samples-heading">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="samples-heading" className="text-center text-2xl font-bold sm:text-3xl">Bills that look like your business</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">A few of the ready-made templates. Change anything, or start from a blank page.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-landing-samples="">
              {samples.map((template) => <Sample key={template.id} template={template} />)}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-center text-2xl font-bold sm:text-3xl">Everything a small business needs to bill</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-border p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 [&_svg]:size-5">{f.icon}</span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-50 py-14" aria-labelledby="compare-heading">
          <div className="mx-auto max-w-3xl px-4">
            <h2 id="compare-heading" className="text-center text-2xl font-bold sm:text-3xl">Why not Excel, Canva or a billing app?</h2>
            <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-white">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium"><span className="sr-only">Feature</span></th>
                    <th className="px-2 py-3 font-semibold text-indigo-700">Receipt Studio</th>
                    <th className="px-2 py-3 font-medium">Excel</th>
                    <th className="px-2 py-3 font-medium">Canva</th>
                    <th className="px-2 py-3 font-medium">Billing apps</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="px-4 py-3">{row.label}</td>
                      <td className="bg-indigo-50/50 px-2 py-3"><Tick on={row.us} label="Receipt Studio" /></td>
                      <td className="px-2 py-3"><Tick on={row.excel} label="Excel" /></td>
                      <td className="px-2 py-3"><Tick on={row.canva} label="Canva" /></td>
                      <td className="px-2 py-3"><Tick on={row.apps} label="Billing apps" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-center text-2xl font-bold sm:text-3xl">Questions</h2>
          <div className="mt-6 divide-y divide-border rounded-lg border border-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-gray-400 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-indigo-700 py-14 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-2xl font-bold sm:text-3xl">Make your next bill with Receipt Studio</h2>
            <p className="mt-2 text-indigo-100">Free while in early access. It takes a minute to start.</p>
            <Button asChild size="lg" variant="secondary" className="mt-6"><Link to={SIGN_UP}>Start free</Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500">
          <span>© {YEAR} Receipt Studio</span>
          <nav className="flex flex-wrap gap-4" aria-label="Legal">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
