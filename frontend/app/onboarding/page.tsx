'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

const ONBOARDING_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #09090b;
    color: #ffffff;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
  }

  :root {
    --purple: #8b5cf6;
    --purple-glow: rgba(139, 92, 246, 0.5);
    --bg-card: #09090b;
    --bg-input: #18181b;
    --border-color: #27272a;
    --text-main: #f4f4f5;
    --text-muted: #a1a1aa;
  }

  .onboarding-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .onboarding-container {
    width: 100%;
    max-width: 550px;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  /* Progress dots */
  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 32px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-color);
    transition: all 0.3s ease;
  }

  .dot.active {
    width: 24px;
    border-radius: 4px;
    background: var(--purple);
    box-shadow: 0 0 8px var(--purple-glow);
  }

  .dot.completed {
    background: #10b981;
  }

  /* Typography */
  .step-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--purple);
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .step-title {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 12px 0;
    color: var(--text-main);
  }

  .step-title .highlight {
    color: var(--purple);
  }

  .step-desc {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin: 0 0 32px 0;
    line-height: 1.5;
  }

  /* Form elements */
  .form-group {
    margin-bottom: 20px;
  }

  .input-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .input-field {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px 16px;
    color: var(--text-main);
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .input-field:focus {
    border-color: var(--purple);
  }

  .input-field.error {
    border-color: #ef4444;
  }

  .error-message {
    color: #ef4444;
    font-size: 0.8rem;
    margin-top: 6px;
  }

  .card-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  .selection-card {
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .selection-card:hover {
    border-color: #3f3f46;
  }

  .selection-card.active {
    border-color: var(--purple);
    background: rgba(139, 92, 246, 0.1);
  }

  .card-text {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .tag-pill {
    background: var(--bg-input);
    border: 1px solid var(--border-color);
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-main);
  }

  .tag-pill:hover {
    border-color: #3f3f46;
  }

  .tag-pill.active {
    border-color: var(--purple);
    background: rgba(139, 92, 246, 0.1);
    color: var(--purple);
    font-weight: 600;
  }

  /* Navigation */
  .nav-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
    gap: 12px;
  }

  .step-counter {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .btn {
    padding: 12px 24px;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-primary {
    background: #ffffff;
    color: #000000;
    flex: 1;
  }

  .btn-primary:hover:not(:disabled) {
    background: #e4e4e7;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    flex: 1;
  }

  .btn-ghost:hover {
    color: #ffffff;
    border-color: #52525b;
  }

  .step-content {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const STEPS = 4;

const BUSINESS_TYPES = ['Healthcare', 'Retail', 'Wholesale', 'Vendor', 'Distributor', 'Agency', 'Other'];
const PERSONAL_TYPES = ['Creator', 'Influencer', 'Consultant', 'Freelancer', 'Professional', 'Student', 'Other'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia'];

interface FormData {
  username: string;
  email: string;
  password: string;
  phone: string;
  accountType: 'personal' | 'business';
  businessName: string;
  businessType: string;
  description: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    phone: '',
    accountType: 'business',
    businessName: '',
    businessType: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const validateEmail = (email: string) => {
    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password);
    const hasMinLength = password.length >= 8;
    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && hasMinLength;
  };

  const validatePhone = (phone: string) => {
    if (formData.accountType === 'business') {
      const regex = /^[6-9][0-9]{9}$/;
      return regex.test(phone);
    }
    return phone.length >= 10;
  };

  const validateUsername = (username: string) => {
    return username.length >= 3;
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.username) newErrors.username = 'Username is required';
      else if (!validateUsername(formData.username))
        newErrors.username = 'Username must be at least 3 characters';

      if (!formData.email) newErrors.email = 'Email is required';
      else if (!validateEmail(formData.email))
        newErrors.email = 'Please enter a valid email';

      if (!formData.password) newErrors.password = 'Password is required';
      else if (!validatePassword(formData.password))
        newErrors.password = 'Password must be 8+ chars with uppercase, lowercase, number, and special char';
    }

    if (step === 2) {
      if (!formData.phone) newErrors.phone = 'Phone is required';
      else if (!validatePhone(formData.phone))
        newErrors.phone = formData.accountType === 'business'
          ? 'Phone must be 10 digits starting with 6-9'
          : 'Phone must be at least 10 digits';
    }

    if (step === 3) {
      if (!formData.accountType) newErrors.accountType = 'Account type is required';
      if (formData.accountType === 'business' && !formData.businessName)
        newErrors.businessName = 'Business name is required';
      if (!formData.businessType) newErrors.businessType = 'Type is required';
      if (formData.businessType === 'Other' && !formData.description)
        newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Register user
      const auth = await apiClient.register(
        formData.email,
        formData.password,
        formData.username,
        formData.accountType
      );

      if (auth.accessToken) {
        localStorage.setItem('accessToken', auth.accessToken);
        localStorage.setItem('refreshToken', auth.refreshToken);

        // Setup business profile
        if (formData.accountType === 'business') {
          await apiClient.setupBusiness({
            businessName: formData.businessName,
            businessType: formData.businessType,
            country: 'India',
            phone: formData.phone,
            industry: formData.businessType,
            website: '',
            description: formData.description,
          });
        }

        router.push('/dashboard');
      }
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  return (
    <>
      <style>{ONBOARDING_STYLES}</style>
      <div className="onboarding-wrapper">
        <div className="onboarding-container">
          {/* Progress dots */}
          <div className="progress-dots">
            {Array.from({ length: STEPS }).map((_, i) => (
              <div
                key={i}
                className={`dot ${i + 1 === currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
              />
            ))}
          </div>

          {/* Step 1: Credentials */}
          {currentStep === 1 && (
            <div className="step-content">
              <div className="step-label">Step 1 of {STEPS}</div>
              <h1 className="step-title">Welcome to <span className="highlight">Versafic</span></h1>
              <p className="step-desc">Create your account to get started</p>

              <div className="form-group">
                <label className="input-label">Username (min 3 chars)</label>
                <input
                  type="text"
                  className={`input-field ${errors.username ? 'error' : ''}`}
                  placeholder="your-username"
                  value={formData.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  disabled={loading}
                />
                {errors.username && <div className="error-message">{errors.username}</div>}
              </div>

              <div className="form-group">
                <label className="input-label">Email</label>
                <input
                  type="email"
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  disabled={loading}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
              </div>

              <div className="form-group">
                <label className="input-label">Password (8+ chars, uppercase, lowercase, number, special char)</label>
                <input
                  type="password"
                  className={`input-field ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  disabled={loading}
                />
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>
            </div>
          )}

          {/* Step 2: Contact */}
          {currentStep === 2 && (
            <div className="step-content">
              <div className="step-label">Step 2 of {STEPS}</div>
              <h1 className="step-title">Your <span className="highlight">contact details</span></h1>
              <p className="step-desc">We'll use this to connect your AI phone number</p>

              <div className="form-group">
                <label className="input-label">Phone Number {formData.accountType === 'business' ? '(10 digits, starts with 6-9)' : ''}</label>
                <input
                  type="tel"
                  className={`input-field ${errors.phone ? 'error' : ''}`}
                  placeholder={formData.accountType === 'business' ? '9876543210' : '(555) 234-5678'}
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  disabled={loading}
                />
                {errors.phone && <div className="error-message">{errors.phone}</div>}
              </div>
            </div>
          )}

          {/* Step 3: Account Type */}
          {currentStep === 3 && (
            <div className="step-content">
              <div className="step-label">Step 3 of {STEPS}</div>
              <h1 className="step-title">What <span className="highlight">best describes</span> you?</h1>
              <p className="step-desc">We'll personalize your AI assistant based on your account type</p>

              <div className="card-grid-2">
                <div
                  className={`selection-card ${formData.accountType === 'business' ? 'active' : ''}`}
                  onClick={() => updateField('accountType', 'business')}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏢</div>
                  <div className="card-text">Business</div>
                </div>
                <div
                  className={`selection-card ${formData.accountType === 'personal' ? 'active' : ''}`}
                  onClick={() => updateField('accountType', 'personal')}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👤</div>
                  <div className="card-text">Personal</div>
                </div>
              </div>

              {formData.accountType === 'business' && (
                <>
                  <div className="form-group">
                    <label className="input-label">Business Name</label>
                    <input
                      type="text"
                      className={`input-field ${errors.businessName ? 'error' : ''}`}
                      placeholder="Your business name"
                      value={formData.businessName}
                      onChange={(e) => updateField('businessName', e.target.value)}
                      disabled={loading}
                    />
                    {errors.businessName && <div className="error-message">{errors.businessName}</div>}
                  </div>

                  <div className="form-group">
                    <label className="input-label">Business Type</label>
                    <div className="tags-grid">
                      {BUSINESS_TYPES.map((type) => (
                        <div
                          key={type}
                          className={`tag-pill ${formData.businessType === type ? 'active' : ''}`}
                          onClick={() => updateField('businessType', type)}
                        >
                          {type}
                        </div>
                      ))}
                    </div>
                    {errors.businessType && <div className="error-message">{errors.businessType}</div>}
                  </div>

                  {formData.businessType === 'Other' && (
                    <div className="form-group">
                      <label className="input-label">Description</label>
                      <input
                        type="text"
                        className={`input-field ${errors.description ? 'error' : ''}`}
                        placeholder="Describe your business"
                        value={formData.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        disabled={loading}
                      />
                      {errors.description && <div className="error-message">{errors.description}</div>}
                    </div>
                  )}
                </>
              )}

              {formData.businessType && formData.accountType === 'personal' && (
                <div className="form-group">
                  <label className="input-label">Type</label>
                  <div className="tags-grid">
                    {PERSONAL_TYPES.map((type) => (
                      <div
                        key={type}
                        className={`tag-pill ${formData.businessType === type ? 'active' : ''}`}
                        onClick={() => updateField('businessType', type)}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                  {errors.businessType && <div className="error-message">{errors.businessType}</div>}
                </div>
              )}

              {!formData.businessType && formData.accountType === 'personal' && (
                <div className="form-group">
                  <label className="input-label">What best describes you?</label>
                  <div className="tags-grid">
                    {PERSONAL_TYPES.map((type) => (
                      <div
                        key={type}
                        className={`tag-pill ${formData.businessType === type ? 'active' : ''}`}
                        onClick={() => updateField('businessType', type)}
                      >
                        {type}
                      </div>
                    ))}
                  </div>
                  {errors.businessType && <div className="error-message">{errors.businessType}</div>}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="step-content">
              <div className="step-label">Step 4 of {STEPS}</div>
              <h1 className="step-title">Review & <span className="highlight">Create</span></h1>
              <p className="step-desc">Confirm your information before completing setup</p>

              <div className="form-group">
                <label className="input-label">Username</label>
                <div className="input-field" style={{ background: 'var(--bg-input)', cursor: 'default', color: 'var(--text-muted)' }}>
                  {formData.username}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Email</label>
                <div className="input-field" style={{ background: 'var(--bg-input)', cursor: 'default', color: 'var(--text-muted)' }}>
                  {formData.email}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Phone</label>
                <div className="input-field" style={{ background: 'var(--bg-input)', cursor: 'default', color: 'var(--text-muted)' }}>
                  {formData.phone}
                </div>
              </div>

              <div className="form-group">
                <label className="input-label">Type</label>
                <div className="input-field" style={{ background: 'var(--bg-input)', cursor: 'default', color: 'var(--text-muted)' }}>
                  {formData.businessType}
                </div>
              </div>

              {errors.submit && <div className="error-message" style={{ marginBottom: '16px' }}>{errors.submit}</div>}
            </div>
          )}

          {/* Navigation */}
          <div className="nav-footer">
            <span className="step-counter">Step {currentStep} of {STEPS}</span>
            <button className="btn btn-ghost" onClick={handleBack} disabled={currentStep === 1 || loading}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? 'Processing...' : currentStep === STEPS ? 'Create Account' : 'Next'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Already have an account? <a href="/login" style={{ color: 'var(--purple)', textDecoration: 'none', fontWeight: '500' }}>Sign In</a>
          </div>
        </div>
      </div>
    </>
  );
}
