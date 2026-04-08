'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

const SEARCH_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #f8fafc;
    color: #1f2937;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .search-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .search-header h1 {
    font-size: 2.5rem;
    font-weight: 800;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .search-header p {
    font-size: 1rem;
    color: #6b7280;
    max-width: 500px;
    margin: 0 auto;
  }

  .search-bar {
    max-width: 600px;
    margin: 0 auto 24px;
    display: flex;
    gap: 12px;
  }

  .search-input {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    outline: none;
    transition: all 0.2s;
  }

  .search-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
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
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 40px;
  }

  .business-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s;
    cursor: pointer;
  }

  .business-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    border-color: #6366f1;
  }

  .card-header {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    padding: 20px;
    color: white;
  }

  .card-name {
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .card-type {
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .card-body {
    padding: 20px;
  }

  .card-info {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: #6b7280;
  }

  .info-item strong {
    color: #1f2937;
    font-weight: 600;
  }

  .card-actions {
    display: flex;
    gap: 8px;
  }

  .btn-sm {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.85rem;
    background: #f3f4f6;
    color: #1f2937;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-sm:hover {
    background: #e5e7eb;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    margin-bottom: 8px;
    color: #1f2937;
  }

  .empty-state p {
    color: #6b7280;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }

  .spinner {
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 4px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const results = await apiClient.searchBusinesses(1, 10) as any;
      setBusinesses(Array.isArray(results) ? results : results.businesses || []);
    } catch (error) {
      console.error('Search error:', error);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{SEARCH_STYLES}</style>
      <div className="container">
        <div className="search-header">
          <h1>Discover Businesses</h1>
          <p>Search and connect with verified businesses in your area</p>
        </div>

        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search business name, type, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            🔍 Search
          </button>
        </form>

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        )}

        {searched && !loading && businesses.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h2>No businesses found</h2>
            <p>Try a different search query or explore available services</p>
          </div>
        )}

        {businesses.length > 0 && (
          <div className="results-grid">
            {businesses.map((business: any) => (
              <div key={business.id} className="business-card" onClick={() => router.push(`/profile/${business.id}`)}>
                <div className="card-header">
                  <div className="card-name">{business.businessName || 'Unknown Business'}</div>
                  <div className="card-type">{business.businessType || business.industry || 'Service'}</div>
                </div>
                <div className="card-body">
                  <div className="card-info">
                    {business.phone && (
                      <div className="info-item">
                        <span>📞</span>
                        <strong>{business.phone}</strong>
                      </div>
                    )}
                    {business.website && (
                      <div className="info-item">
                        <span>🌐</span>
                        <strong>{business.website}</strong>
                      </div>
                    )}
                    {business.country && (
                      <div className="info-item">
                        <span>📍</span>
                        <strong>{business.country}</strong>
                      </div>
                    )}
                  </div>
                  <div className="card-actions">
                    <button className="btn-sm" onClick={() => router.push(`/profile/${business.id}`)}>
                      View
                    </button>
                    <button className="btn-sm" onClick={() => alert('Contact feature coming soon')}>
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!searched && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h2>Start Searching</h2>
            <p>Enter a business name to get started</p>
          </div>
        )}
      </div>
    </>
  );
}
