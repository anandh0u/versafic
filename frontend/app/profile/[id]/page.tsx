'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { BusinessProfile } from '@/types/index';

const PROFILE_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: linear-gradient(135deg, #0f1629 0%, #0c1220 100%);
    color: #ffffff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100vh;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #a5b4fc;
    text-decoration: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    margin-bottom: 24px;
    display: inline-flex;
  }

  .back-button:hover {
    background: rgba(99, 102, 241, 0.2);
  }

  .profile-header {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 16px;
    padding: 40px;
    margin-bottom: 32px;
  }

  .profile-name {
    font-size: 2.5rem;
    font-weight: 800;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .profile-type {
    font-size: 1rem;
    color: #9ca3af;
    margin-bottom: 20px;
  }

  .profile-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }

  .meta-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
  }

  .meta-label {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-bottom: 4px;
  }

  .meta-value {
    font-size: 1rem;
    font-weight: 600;
    color: #e5e7eb;
  }

  .content-section {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }

  .section-title {
    font-size: 1.3rem;
    font-weight: 700;
    margin-bottom: 16px;
    color: #f3f4f6;
  }

  .info-grid {
    display: grid;
    gap: 16px;
  }

  .info-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .info-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .info-content {
    flex: 1;
  }

  .info-label {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 4px;
  }

  .info-text {
    font-size: 1rem;
    color: #e5e7eb;
    word-break: break-word;
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 24px;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
  }

  .btn-ghost {
    background: rgba(99, 102, 241, 0.1);
    color: #a5b4fc;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .btn-ghost:hover {
    background: rgba(99, 102, 241, 0.2);
  }

  .loading {
    text-align: center;
    padding: 60px 20px;
  }

  .spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 4px solid rgba(99, 102, 241, 0.2);
    border-top-color: #a5b4fc;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 24px;
  }
`;

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const businessId = params.id as string;

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (businessId) {
      loadProfile();
    }
  }, [businessId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // For now, we'll accept email or ID - backend should handle this
      const profile = await apiClient.getBusinessByEmail(businessId);
      setProfile(profile);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <style>{PROFILE_STYLES}</style>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
          </div>
        </div>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <style>{PROFILE_STYLES}</style>
        <div className="container">
          <button className="back-button" onClick={() => router.back()}>
            ← Go Back
          </button>
          <div className="error-message">
            {error || 'Business profile not found'}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{PROFILE_STYLES}</style>
      <div className="container">
        <button className="back-button" onClick={() => router.back()}>
          ← Go Back
        </button>

        <div className="profile-header">
          <div className="profile-name">{profile.businessName}</div>
          <div className="profile-type">{profile.businessType} • {profile.industry}</div>

          <div className="profile-meta">
            {profile.country && (
              <div className="meta-item">
                <div className="meta-label">📍 Location</div>
                <div className="meta-value">{profile.country}</div>
              </div>
            )}
            {profile.phone && (
              <div className="meta-item">
                <div className="meta-label">📞 Phone</div>
                <div className="meta-value">{profile.phone}</div>
              </div>
            )}
            {profile.website && (
              <div className="meta-item">
                <div className="meta-label">🌐 Website</div>
                <div className="meta-value" style={{ fontSize: '0.9rem', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {profile.website}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="content-section">
          <div className="section-title">About</div>
          <div className="info-grid">
            <div className="info-row">
              <div className="info-icon">🏢</div>
              <div className="info-content">
                <div className="info-label">Business Type</div>
                <div className="info-text">{profile.businessType}</div>
              </div>
            </div>

            {profile.industry && (
              <div className="info-row">
                <div className="info-icon">💼</div>
                <div className="info-content">
                  <div className="info-label">Industry</div>
                  <div className="info-text">{profile.industry}</div>
                </div>
              </div>
            )}

            {profile.description && (
              <div className="info-row">
                <div className="info-icon">📝</div>
                <div className="info-content">
                  <div className="info-label">Description</div>
                  <div className="info-text">{profile.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="content-section">
          <div className="section-title">Contact Information</div>
          <div className="info-grid">
            {profile.phone && (
              <div className="info-row">
                <div className="info-icon">📞</div>
                <div className="info-content">
                  <div className="info-label">Phone</div>
                  <div className="info-text">{profile.phone}</div>
                </div>
              </div>
            )}

            {profile.website && (
              <div className="info-row">
                <div className="info-icon">🌐</div>
                <div className="info-content">
                  <div className="info-label">Website</div>
                  <div className="info-text">
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc', textDecoration: 'none' }}>
                      {profile.website} ↗
                    </a>
                  </div>
                </div>
              </div>
            )}

            {profile.country && (
              <div className="info-row">
                <div className="info-icon">📍</div>
                <div className="info-content">
                  <div className="info-label">Location</div>
                  <div className="info-text">{profile.country}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={() => alert('Call feature coming soon')}>
            📞 Call Business
          </button>
          <button className="btn btn-ghost" onClick={() => alert('Message feature coming soon')}>
            💬 Send Message
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/search')}>
            🔍 Back to Search
          </button>
        </div>
      </div>
    </>
  );
}
