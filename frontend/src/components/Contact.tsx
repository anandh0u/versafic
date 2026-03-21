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
    <section id="contact" className="py-32 bg-slate-800">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left side - Contact info */}
          <div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Let's Talk
            </h2>
            <p className="text-slate-400 text-lg mb-12 leading-relaxed">
              Ready to automate your customer service? Book a demo or reach out with questions.
            </p>

            <div className="space-y-8">
              <div className="flex items-start">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mr-5 flex-shrink-0">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2 text-lg">Email Us</h4>
                  <a href="mailto:hello@versafic.com" className="text-slate-400 hover:text-indigo-400 transition-colors">
                    hello@versafic.com
                  </a>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mr-5 flex-shrink-0">
                  <Phone className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2 text-lg">Call Us</h4>
                  <a href="tel:+919876543210" className="text-slate-400 hover:text-purple-400 transition-colors">
                    +91 98765 43210
                  </a>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-14 h-14 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center mr-5 flex-shrink-0">
                  <MapPin className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2 text-lg">Location</h4>
                  <p className="text-slate-400">
                    Bangalore, India
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Contact form */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-10">
            {submitted ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Message Sent!</h3>
                <p className="text-slate-400 text-lg">
                  We'll get back to you soon.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-8 text-indigo-400 hover:text-indigo-300"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block font-medium text-slate-300 mb-3">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-3">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-3">
                    Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-lg"
                    placeholder="Tell us about your business..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <span>Sending...</span>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
