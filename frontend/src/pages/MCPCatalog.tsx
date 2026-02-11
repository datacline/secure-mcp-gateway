import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ExternalLink, CheckCircle, RefreshCw, AlertCircle, Terminal, Globe, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, Eye, X, Copy } from 'lucide-react';
import {
  searchCatalog,
  getCategories,
  getCategoryLabel,
  getCategoryIcon,
  defaultSearchTerms,
  type MCPCatalogItem,
  type CatalogCategory,
} from '../data/mcpCatalog';
import { javaGatewayMcpApi } from '../services/api';
import AddMCPServerDialog from '../components/AddMCPServerDialog';
import './MCPCatalog.css';

const PAGE_SIZE = 12;

type ServerTypeFilter = 'all' | 'http' | 'stdio';

export default function MCPCatalog() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState(''); // Empty = show all
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [serverTypeFilter, setServerTypeFilter] = useState<ServerTypeFilter>('all');
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [addingServer, setAddingServer] = useState<string | null>(null);
  const [addedServers, setAddedServers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogItems, setCatalogItems] = useState<MCPCatalogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [cacheStatus, setCacheStatus] = useState<string>('');
  const [apiConfigured, setApiConfigured] = useState(true);
  const [selectedServer, setSelectedServer] = useState<MCPCatalogItem | null>(null);
  const [serverToAdd, setServerToAdd] = useState<MCPCatalogItem | null>(null);

  // Load categories and initial data on mount
  useEffect(() => {
    loadCategories();
    loadExistingServers();
    // Initial load with empty query to get all items (page 1, not 0)
    performSearch('', 1);
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadExistingServers = async () => {
    try {
      const response = await javaGatewayMcpApi.listServers();
      const existingNames = new Set(response.servers.map(s => s.name.toLowerCase()));
      setAddedServers(existingNames);
    } catch (err) {
      console.error('Failed to load existing servers:', err);
    }
  };

  const performSearch = useCallback(async (query: string, page: number = 1) => {
    setLoading(true);
    setError(null);

    const offset = (page - 1) * PAGE_SIZE;

    try {
      const response = await searchCatalog(query, PAGE_SIZE, offset);

      // Normalize servers to always be an array (backend may return null)
      const servers = Array.isArray(response.servers) ? response.servers : [];

      // Log response for debugging
      console.log('Search response:', {
        query,
        totalCount: response.total_count,
        returnedCount: response.returned_count,
        serversLength: servers.length,
      });

      setCatalogItems(servers);
      setTotalCount(response.total_count || 0);
      setTotalPages(response.total_pages || 0);
      setCurrentPage(response.page || 1);
      setCacheStatus(response.cache_status || 'ready');
      setApiConfigured(true);
    } catch (err: any) {
      console.error('Failed to search catalog:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to search catalog';

      if (errorMessage.includes('API key not configured')) {
        setApiConfigured(false);
        setError('Postman API key not configured. Please set POSTMAN_API_KEY in the policy engine.');
      } else {
        setError(errorMessage);
      }
      setCatalogItems([]);
      setTotalCount(0);
      setTotalPages(0);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setCurrentPage(1);
    performSearch(searchQuery.trim(), 1);
  };

  const handleQuickSearch = (term: string) => {
    setSearchQuery(term);
    setActiveSearch(term);
    setCurrentPage(1);
    performSearch(term, 1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
    setCurrentPage(1);
    performSearch('', 1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    performSearch(activeSearch, page);
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToOrg = async (item: MCPCatalogItem) => {
    setAddingServer(item.id);
    setError(null);

    try {
      // Use the type from config (parsed by backend)
      const mcpType = item.type || item.config?.type || 'stdio';
      const isHttpServer = mcpType === 'http' || mcpType === 'sse';
      
      const serverConfig: MCPServerConfigRequest = {
        // Only set URL for HTTP servers; for stdio, use a placeholder or leave empty
        url: isHttpServer 
          ? (item.config?.url || `https://${item.name.toLowerCase().replace(/\s+/g, '-')}.example.com/mcp`)
          : `stdio://${item.name.toLowerCase().replace(/\s+/g, '-')}`, // Placeholder for stdio
        type: mcpType === 'sse' ? 'http' : mcpType, // Normalize sse to http
        timeout: 60,
        enabled: false,
        description: item.description,
        tags: item.tags,
        metadata: {
          source: 'postman-catalog',
          catalogId: item.id,
          publisherId: item.publisher.id,
          publisherName: item.publisher.name,
          verified: item.publisher.verified,
          serverType: mcpType,
          // Store original config for reference
          command: item.config?.command,
          args: item.config?.args,
          env: item.config?.env,
          headers: item.config?.headers,
        },
      };

      // Set up auth based on parsed config
      if (item.config?.auth_method && item.config.auth_method !== 'none') {
        if (item.config.auth_method === 'bearer') {
          serverConfig.auth = {
            method: 'bearer',
            location: 'header',
            name: item.config.auth_header_name || 'Authorization',
            format: 'prefix',
            prefix: 'Bearer ',
            credential_ref: item.config.auth_env_var 
              ? `env://${item.config.auth_env_var}`
              : `env://MCP_${item.name.toUpperCase().replace(/\s+/g, '_')}_TOKEN`,
          };
        } else if (item.config.auth_method === 'api_key') {
          serverConfig.auth = {
            method: 'api_key',
            location: 'header',
            name: item.config.auth_header_name || 'X-API-Key',
            format: 'raw',
            credential_ref: item.config.auth_env_var 
              ? `env://${item.config.auth_env_var}`
              : `env://MCP_${item.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`,
          };
        } else if (item.config.auth_method === 'env_var' && item.config.auth_env_var) {
          // For stdio servers with env var auth
          serverConfig.auth = {
            method: 'bearer',
            location: 'header',
            name: 'Authorization',
            format: 'prefix',
            prefix: 'Bearer ',
            credential_ref: `env://${item.config.auth_env_var}`,
          };
        }
      } else if (item.config?.headers && Object.keys(item.config.headers).length > 0) {
        // Fallback: check headers directly
        const headerName = Object.keys(item.config.headers)[0];
        serverConfig.auth = {
          method: 'api_key',
          location: 'header',
          name: headerName,
          format: 'raw',
          credential_ref: `env://MCP_${item.name.toUpperCase().replace(/\s+/g, '_')}_API_KEY`,
        };
      } else if (item.config?.env && Object.keys(item.config.env).length > 0) {
        // Fallback: check env vars directly
        const envVar = Object.keys(item.config.env)[0];
        serverConfig.auth = {
          method: 'bearer',
          location: 'header',
          name: 'Authorization',
          format: 'prefix',
          prefix: 'Bearer ',
          credential_ref: `env://${envVar}`,
        };
      }

      const serverName = item.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      await javaGatewayMcpApi.createServer(serverName, serverConfig);
      setAddedServers(prev => new Set([...prev, serverName]));
      navigate(`/mcp-servers/${serverName}?tab=configure`);
    } catch (err: any) {
      const errorMessage = err.message || err.response?.data?.error || 'Failed to add server';
      if (errorMessage.includes('already exists')) {
        const serverName = item.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        setError(`${item.name} is already added to your organization`);
        setAddedServers(prev => new Set([...prev, serverName]));
      } else {
        setError(errorMessage);
      }
    } finally {
      setAddingServer(null);
    }
  };

  const getServerName = (item: MCPCatalogItem): string => {
    return item.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const isServerAdded = (item: MCPCatalogItem): boolean => {
    return addedServers.has(getServerName(item));
  };

  // Generate page numbers to display
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  // Get the server type for an item
  const getItemServerType = (item: MCPCatalogItem): 'http' | 'stdio' => {
    const type = item.type || item.config?.type || 'stdio';
    return type === 'http' || type === 'sse' ? 'http' : 'stdio';
  };

  // Count servers by type
  const typeCounts = useMemo(() => {
    const counts = { all: catalogItems.length, http: 0, stdio: 0 };
    catalogItems.forEach(item => {
      const type = getItemServerType(item);
      if (type === 'http') counts.http++;
      else counts.stdio++;
    });
    return counts;
  }, [catalogItems]);

  // Apply both category and server type filters
  const filteredItems = useMemo(() => {
    let items = catalogItems;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      items = items.filter(item => item.category === selectedCategory);
    }
    
    // Filter by server type
    if (serverTypeFilter !== 'all') {
      items = items.filter(item => getItemServerType(item) === serverTypeFilter);
    }
    
    return items;
  }, [catalogItems, selectedCategory, serverTypeFilter]);

  return (
    <div className="mcp-catalog-page">
      <div className="page-header">
        <div className="header-content">
          <h1>MCP Catalog</h1>
          <p className="page-description">
            Browse and add MCP servers to your organization. Powered by{' '}
            <a href="https://www.postman.com/explore/mcp-servers" target="_blank" rel="noopener noreferrer">
              Postman MCP Catalog <ExternalLink size={12} />
            </a>
            {cacheStatus === 'loading' && (
              <span className="cache-status loading">
                <RefreshCw size={12} className="spinning" /> Loading catalog...
              </span>
            )}
          </p>
        </div>
        <button 
          className="btn-refresh" 
          onClick={() => performSearch(activeSearch, currentPage)}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {error && (
        <div className={`error-banner ${!apiConfigured ? 'warning' : ''}`}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="catalog-controls">
        <form className="search-box" onSubmit={handleSearch}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search MCP servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {activeSearch && (
            <button type="button" className="clear-search-btn" onClick={handleClearSearch}>
              ×
            </button>
          )}
          <button type="submit" className="search-btn" disabled={loading}>
            Search
          </button>
        </form>

        <div className="quick-search">
          <span className="quick-search-label">Browse:</span>
          <button
            className={`quick-search-btn ${activeSearch === '' ? 'active' : ''}`}
            onClick={handleClearSearch}
          >
            All
          </button>
          {defaultSearchTerms.slice(0, 5).map(term => (
            <button
              key={term}
              className={`quick-search-btn ${activeSearch === term ? 'active' : ''}`}
              onClick={() => handleQuickSearch(term)}
            >
              {term}
            </button>
          ))}
        </div>

        <div className="type-filter">
          <span className="type-filter-label">
            <Filter size={14} />
            Type:
          </span>
          <button
            className={`type-filter-btn ${serverTypeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setServerTypeFilter('all')}
          >
            All
            <span className="count">{typeCounts.all}</span>
          </button>
          <button
            className={`type-filter-btn http ${serverTypeFilter === 'http' ? 'active' : ''}`}
            onClick={() => setServerTypeFilter('http')}
          >
            <Globe size={14} />
            HTTP
            <span className="count">{typeCounts.http}</span>
          </button>
          <button
            className={`type-filter-btn stdio ${serverTypeFilter === 'stdio' ? 'active' : ''}`}
            onClick={() => setServerTypeFilter('stdio')}
          >
            <Terminal size={14} />
            STDIO
            <span className="count">{typeCounts.stdio}</span>
          </button>
        </div>
      </div>

      <div className="catalog-stats">
        {loading ? (
          <span>Searching...</span>
        ) : (
          <span>
            {serverTypeFilter !== 'all' ? (
              <>
                Showing <strong>{filteredItems.length}</strong> {serverTypeFilter.toUpperCase()} servers
                {activeSearch && <> for "{activeSearch}"</>}
                <span className="stats-total"> (of {totalCount} total)</span>
              </>
            ) : activeSearch ? (
              <>Found <strong>{totalCount}</strong> MCP servers for "{activeSearch}"</>
            ) : (
              <>Showing <strong>{totalCount}</strong> MCP servers</>
            )}
            {totalPages > 1 && serverTypeFilter === 'all' && (
              <> · Page {currentPage} of {totalPages}</>
            )}
          </span>
        )}
      </div>

      <div className="catalog-grid">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spinning" />
            <p>Loading MCP Catalog...</p>
          </div>
        ) : error && filteredItems.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <h3>Search Error</h3>
            <p>{error}</p>
            <button
              className="btn-refresh"
              onClick={() => performSearch(activeSearch || '', currentPage)}
              style={{ marginTop: '1rem' }}
            >
              Try Again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            {!apiConfigured ? (
              <>
                <AlertCircle size={48} />
                <h3>API Key Required</h3>
                <p>To browse the MCP Catalog, configure the POSTMAN_API_KEY environment variable in the policy engine.</p>
              </>
            ) : cacheStatus === 'loading' ? (
              <>
                <RefreshCw size={48} className="spinning" />
                <h3>Loading Catalog</h3>
                <p>The MCP catalog is being loaded. Please wait a moment...</p>
              </>
            ) : activeSearch || serverTypeFilter !== 'all' ? (
              <>
                <Search size={48} />
                <h3>No MCP server found</h3>
                <p>
                  {activeSearch && serverTypeFilter !== 'all'
                    ? `No ${serverTypeFilter.toUpperCase()} servers found for "${activeSearch}"`
                    : activeSearch
                      ? `No MCP server found for "${activeSearch}"`
                      : `No ${serverTypeFilter.toUpperCase()} servers available`
                  }
                </p>
              </>
            ) : (
              <>
                <Search size={48} />
                <h3>No servers available</h3>
                <p>The MCP catalog is empty.</p>
              </>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className={`catalog-card ${isServerAdded(item) ? 'added' : ''}`}>
              <div className="card-header">
                <div className="server-icon">
                  {item.publisher.logo ? (
                    <img src={item.publisher.logo} alt={item.publisher.name} />
                  ) : (
                    getCategoryIcon(item.category)
                  )}
                </div>
                <div className="server-info">
                  <h3>{item.name}</h3>
                  <div className="badges">
                    {item.official && (
                      <span className="badge badge-verified">
                        <CheckCircle size={10} /> Verified
                      </span>
                    )}
                    <span className={`badge badge-type ${item.type || item.config?.type || 'stdio'}`}>
                      {(item.type === 'http' || item.server_type === 'sse') ? <Globe size={10} /> : <Terminal size={10} />}
                      {(item.type || item.config?.type || 'stdio').toUpperCase()}
                    </span>
                    <span className="badge badge-category">
                      {getCategoryIcon(item.category)} {getCategoryLabel(item.category)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="card-description">
                {item.description || `MCP server by ${item.publisher.name}`}
              </p>

              <div className="publisher-info">
                <span className="publisher-name">
                  By {item.publisher.name}
                  {item.publisher.verified && <CheckCircle size={12} className="verified-icon" />}
                </span>
              </div>

              <div className="card-tags">
                {item.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
                {item.tags.length > 4 && (
                  <span className="tag tag-more">+{item.tags.length - 4}</span>
                )}
              </div>

              <div className="card-footer">
                {item.config?.url && (
                  <span className="server-url" title={item.config.url}>
                    <Globe size={12} />
                    {(() => { try { return new URL(item.config.url).hostname; } catch { return item.config.url; } })()}
                  </span>
                )}
                {item.config?.command && (
                  <span className="server-command" title={`${item.config.command} ${(item.config?.args || []).join(' ')}`}>
                    <Terminal size={12} />
                    {item.config.command}
                  </span>
                )}

                <div className="card-actions">
                  <button
                    className="btn btn-view"
                    onClick={() => setSelectedServer(item)}
                    title="View details"
                  >
                    <Eye size={16} />
                    View
                  </button>

                  {isServerAdded(item) ? (
                    <button
                      className="btn btn-added"
                      onClick={() => navigate(`/mcp-servers/${getServerName(item)}?tab=configure`)}
                    >
                      <CheckCircle size={16} />
                      Configure
                    </button>
                  ) : (
                    <button
                      className="btn btn-add"
                      onClick={() => setServerToAdd(item)}
                      disabled={addingServer === item.id}
                    >
                      {addingServer === item.id ? (
                        <span className="spinner-small" />
                      ) : (
                        <Plus size={16} />
                      )}
                      Add to Org
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="pagination-section">
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="pagination-pages">
              {getPageNumbers().map((page, index) => (
                typeof page === 'number' ? (
                  <button
                    key={index}
                    className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={index} className="pagination-ellipsis">{page}</span>
                )
              ))}
            </div>

            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>

          <div className="pagination-info">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
          </div>
        </div>
      )}

      {/* Server Details Modal */}
      {selectedServer && (
        <div className="server-details-overlay" onClick={() => setSelectedServer(null)}>
          <div className="server-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon">
                  {selectedServer.publisher.logo ? (
                    <img src={selectedServer.publisher.logo} alt={selectedServer.publisher.name} />
                  ) : (
                    getCategoryIcon(selectedServer.category)
                  )}
                </div>
                <div className="modal-title-info">
                  <h2>{selectedServer.name}</h2>
                  <div className="modal-badges">
                    {selectedServer.official && (
                      <span className="badge badge-verified">
                        <CheckCircle size={10} /> Verified
                      </span>
                    )}
                    <span className={`badge badge-type ${selectedServer.type || selectedServer.config?.type || 'stdio'}`}>
                      {(selectedServer.type === 'http' || selectedServer.server_type === 'sse') ? <Globe size={10} /> : <Terminal size={10} />}
                      {(selectedServer.type || selectedServer.config?.type || 'stdio').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedServer(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Description</h4>
                <p>{selectedServer.description || 'No description available.'}</p>
              </div>

              <div className="detail-section">
                <h4>Publisher</h4>
                <div className="publisher-detail">
                  {selectedServer.publisher.logo && (
                    <img src={selectedServer.publisher.logo} alt={selectedServer.publisher.name} className="publisher-logo" />
                  )}
                  <span>{selectedServer.publisher.name}</span>
                  {selectedServer.publisher.verified && <CheckCircle size={14} className="verified-icon" />}
                </div>
              </div>

              <div className="detail-section">
                <h4>Category</h4>
                <span className="category-badge">
                  {getCategoryIcon(selectedServer.category)} {getCategoryLabel(selectedServer.category)}
                </span>
              </div>

              {selectedServer.tags.length > 0 && (
                <div className="detail-section">
                  <h4>Tags</h4>
                  <div className="tags-list">
                    {selectedServer.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h4>Configuration</h4>
                <div className="config-block">
                  {selectedServer.config?.url && (
                    <div className="config-item">
                      <label>URL:</label>
                      <div className="config-value">
                        <code>{selectedServer.config.url}</code>
                        <button 
                          className="copy-btn"
                          onClick={() => navigator.clipboard.writeText(selectedServer.config?.url || '')}
                          title="Copy URL"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedServer.config?.command && (
                    <div className="config-item">
                      <label>Command:</label>
                      <div className="config-value">
                        <code>{selectedServer.config.command} {(selectedServer.config?.args || []).join(' ')}</code>
                        <button 
                          className="copy-btn"
                          onClick={() => {
                            const cmd = `${selectedServer.config?.command || ''} ${(selectedServer.config?.args || []).join(' ')}`;
                            navigator.clipboard.writeText(cmd);
                          }}
                          title="Copy command"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedServer.config?.env && Object.keys(selectedServer.config.env).length > 0 && (
                    <div className="config-item">
                      <label>Environment Variables:</label>
                      <div className="env-vars">
                        {Object.entries(selectedServer.config.env).map(([key, value]) => (
                          <div key={key} className="env-var">
                            <code>{key}</code>
                            <span>=</span>
                            <code>{value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedServer.config?.headers && Object.keys(selectedServer.config.headers).length > 0 && (
                    <div className="config-item">
                      <label>Headers:</label>
                      <div className="env-vars">
                        {Object.entries(selectedServer.config.headers).map(([key, value]) => (
                          <div key={key} className="env-var">
                            <code>{key}</code>
                            <span>:</span>
                            <code>{value}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedServer.config?.auth_method && selectedServer.config.auth_method !== 'none' && (
                    <div className="config-item">
                      <label>Authentication:</label>
                      <span className="auth-method">{selectedServer.config.auth_method.toUpperCase()}</span>
                      {selectedServer.config.auth_env_var && (
                        <span className="auth-env"> (via {selectedServer.config.auth_env_var})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {isServerAdded(selectedServer) ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedServer(null);
                    navigate(`/mcp-servers/${getServerName(selectedServer)}?tab=configure`);
                  }}
                >
                  <CheckCircle size={16} />
                  Configure Server
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setServerToAdd(selectedServer);
                    setSelectedServer(null);
                  }}
                  disabled={addingServer === selectedServer.id}
                >
                  <Plus size={16} />
                  Add to Organization
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedServer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add MCP Server Dialog */}
      {serverToAdd && (
        <AddMCPServerDialog
          server={serverToAdd}
          onClose={() => setServerToAdd(null)}
          onSuccess={(serverName: string) => {
            // Refresh the org servers list and navigate to configure
            loadExistingServers();
            setServerToAdd(null);
            navigate(`/mcp-servers/${serverName}?tab=configure`);
          }}
        />
      )}
    </div>
  );
}
