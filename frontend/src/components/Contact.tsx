import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setSubmitted(true);
    setFormData({ name: '', email: '', company: '', message: '' });
  };

  return (
    <section id="contact" className="section-shell bg-white/[0.02]">
      <div className="page-container">
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div className="section-kicker">Book a demo</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Show clients a support experience that feels fast, reliable, and on-brand.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Share a few details about your business and we’ll help you map the best AI setup for calls, chat, and
                customer follow-up.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="stat-card">
                  <p className="text-sm font-medium text-slate-400">Best for</p>
                  <p className="mt-2 text-lg font-semibold text-white">Restaurants, clinics, hotels, and service teams</p>
                </div>
                <div className="stat-card">
                  <p className="text-sm font-medium text-slate-400">Demo focus</p>
                  <p className="mt-2 text-lg font-semibold text-white">Workflows, pricing, and launch readiness</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">Email us</h4>
                    <a href="mailto:hello@versafic.com" className="mt-1 block text-slate-300 transition hover:text-white">
                      hello@versafic.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">Call us</h4>
                    <a href="tel:+919876543210" className="mt-1 block text-slate-300 transition hover:text-white">
                      +91 98765 43210
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">Location</h4>
                    <p className="mt-1 text-slate-300">Bangalore, India</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              {submitted ? (
                <div className="flex h-full min-h-[26rem] flex-col items-center justify-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <Send className="h-9 w-9" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-white">Message sent successfully</h3>
                  <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
                    Thanks for reaching out. We’ll review your request and get back to you with next steps shortly.
                  </p>
                  <button onClick={() => setSubmitted(false)} className="button-secondary mt-8">
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h3 className="text-2xl font-semibold text-white">Tell us about your business</h3>
                    <p className="mt-2 text-base leading-7 text-slate-300">
                      We’ll use this to tailor a product walkthrough and recommend the right pricing setup.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="form-label">Your Name</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="input-field"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="form-label">Email Address</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="input-field"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Company</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="input-field"
                        placeholder="Acme Hospitality"
                      />
                    </div>

                    <div>
                      <label className="form-label">What would you like to automate?</label>
                      <textarea
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="textarea-field"
                        placeholder="Share your support volume, channels, and the kind of customer queries you want the AI assistant to handle."
                      />
                    </div>

                    <button type="submit" disabled={isSubmitting} className="button-primary w-full justify-center text-base">
                      {isSubmitting ? (
                        <span>Sending...</span>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Request Demo
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
