import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemReady, setSystemReady] = useState(false);
  const [filterUnresolved, setFilterUnresolved] = useState(false);
  const [updating, setUpdating] = useState({});
  const [sortOrder, setSortOrder] = useState('priority-high-to-low');

  useEffect(() => {
    const checkReady = async () => {
      try {
        const response = await axios.get('/ready');
        const isReady = response.data.ready;
        setSystemReady(isReady);
        
        // Auto-load all tickets when system becomes ready
        if (isReady && results.length === 0) {
          loadAllTickets();
        }
      } catch (err) {
        console.error('Failed to check system status');
      }
    };

    checkReady();
    const interval = setInterval(checkReady, 1000);
    return () => clearInterval(interval);
  }, [results.length]);

  useEffect(() => {
    // Only reload when sort order changes and we already have results
    if (systemReady && results.length > 0) {
      const reloadWithNewSort = async () => {
        setLoading(true);
        try {
          const searchQuery = query.trim() || '*';
          const response = await axios.get(`/search?q=${encodeURIComponent(searchQuery)}&filterUnresolved=${filterUnresolved}&sortOrder=${sortOrder}`);
          setResults(response.data.results || []);
        } catch (err) {
          setError('Failed to reload tickets with new sort order.');
        } finally {
          setLoading(false);
        }
      };
      reloadWithNewSort();
    }
  }, [sortOrder]);

  const loadAllTickets = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`/search?q=*&filterUnresolved=${filterUnresolved}&sortOrder=${sortOrder}`);
      setResults(response.data.results || []);
    } catch (err) {
      setError('Failed to load tickets. Please try again.');
      console.error('Load tickets error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setError('');
    
    try {
      // Use * for empty queries to show all tickets
      const searchQuery = query.trim() || '*';
      const response = await axios.get(`/search?q=${encodeURIComponent(searchQuery)}&filterUnresolved=${filterUnresolved}&sortOrder=${sortOrder}`);
      setResults(response.data.results || []);
    } catch (err) {
      setError('Failed to search. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (email, newStatus) => {
    setUpdating(prev => ({ ...prev, [email]: true }));
    
    try {
      await axios.post('/update-status', { email, status: newStatus });
      
      setResults(prev => prev.map(result => 
        result.customer_email === email 
          ? { ...result, status: newStatus }
          : result
      ));
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setUpdating(prev => ({ ...prev, [email]: false }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getHighlightedText = (text, highlights) => {
    if (!highlights) return text;
    
    let highlighted = text;
    highlights.forEach(h => {
      highlighted = highlighted.replace(new RegExp(h, 'gi'), `<mark>${h}</mark>`);
    });
    return { __html: highlighted };
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1:
        return 'High';
      case 2:
        return 'Medium';
      case 3:
        return 'Low';
      default:
        return `P${priority}`;
    }
  };

  return (
    <div className="container">
      <h1>Support Ticket Search</h1>
      
      <div className={`system-status ${systemReady ? 'ready' : 'loading'}`}>
        System Status: {systemReady ? '✅ Ready' : '⏳ Initializing...'}
      </div>
      
      <div className="search-container">
        <form onSubmit={handleSearch}>
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Search for tickets by title, description, tags, or email... (leave empty to show all)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="search-button" disabled={loading || !systemReady}>
              {loading ? 'Searching...' : (query.trim() ? 'Search' : 'Show All')}
            </button>
          </div>
          
          <div className="filter-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filterUnresolved}
                onChange={(e) => setFilterUnresolved(e.target.checked)}
              />
              Show only unresolved tickets
            </label>
            
            <div className="sort-option">
              <label htmlFor="sort-select">Sort by priority:</label>
              <select
                id="sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="sort-select"
              >
                <option value="priority-high-to-low">High to Low</option>
                <option value="priority-low-to-high">Low to High</option>
              </select>
            </div>
          </div>
        </form>

        {error && <div className="error">{error}</div>}
        
        {results.length > 0 && (
          <div className="results-info">
            {query.trim() ? (
              <>Found {results.length} results for "{query}"{filterUnresolved && ' (filtered for unresolved)'}</>
            ) : (
              <>Showing {results.length} tickets{filterUnresolved && ' (filtered for unresolved)'}</>
            )}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="results-container">
          {results.map((result) => (
            <div key={result.id} className="result-item">
              <div className="result-header">
                <h3 className="result-title">
                  {result.highlights?.title ? (
                    <span dangerouslySetInnerHTML={getHighlightedText(result.title, result.highlights.title)} />
                  ) : (
                    result.title
                  )}
                </h3>
                <span className={`priority-badge priority-${result.priority}`}>
                  {getPriorityLabel(result.priority)}
                </span>
              </div>
              
              <p className="result-description">
                {result.highlights?.description ? (
                  <span dangerouslySetInnerHTML={getHighlightedText(result.description, result.highlights.description)} />
                ) : (
                  result.description
                )}
              </p>
              
              <div className="result-meta">
                <span className="result-email">
                  Customer: {result.customer_email}
                </span>
                
                <span className={`status status-${result.status}`}>
                  {result.status}
                </span>
                
                <span>
                  Created: {formatDate(result.created_date)}
                </span>
                
                <span className="score">
                  Score: {result.score?.toFixed(2)}
                </span>
              </div>
              
              <div className="action-buttons">
                <button
                  className="action-btn resolve-btn"
                  onClick={() => handleStatusUpdate(result.customer_email, 'resolved')}
                  disabled={updating[result.customer_email] || result.status === 'resolved'}
                >
                  {updating[result.customer_email] ? 'Updating...' : 'Mark Resolved'}
                </button>
                <button
                  className="action-btn reject-btn"
                  onClick={() => handleStatusUpdate(result.customer_email, 'rejected')}
                  disabled={updating[result.customer_email] || result.status === 'rejected'}
                >
                  {updating[result.customer_email] ? 'Updating...' : 'Reject'}
                </button>
              </div>
              
              {result.tags && (
                <div className="result-tags">
                  {result.tags.split(' ').map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App; 