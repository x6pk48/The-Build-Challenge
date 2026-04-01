export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Serve static files
      if (path === '/' || path === '/dashboard') {
        return new Response(getHtml(), { 
          headers: { 'Content-Type': 'text/html' } 
        });
      }
      
      if (path === '/css/style.css') {
        return new Response(getCss(), { 
          headers: { 'Content-Type': 'text/css' } 
        });
      }
      
      if (path === '/js/app.js') {
        return new Response(getJs(), { 
          headers: { 'Content-Type': 'application/javascript' } 
        });
      }

      // API: Get all feedback
      if (path === '/api/feedback' && request.method === 'GET') {
        await initDatabase(env.FEEDBACK_DB);
        const result = await env.FEEDBACK_DB.prepare("SELECT * FROM feedback ORDER BY created_at DESC").all();
        return Response.json({ success: true, data: result.results });
      }

      // API: Add test feedback
      if (path === '/api/feedback' && request.method === 'POST') {
        const body = await request.json();
        await initDatabase(env.FEEDBACK_DB);
        const id = Date.now().toString();
        await env.FEEDBACK_DB.prepare(
          "INSERT INTO feedback (id, source, content, created_at) VALUES (?, ?, ?, ?)"
        ).bind(id, body.source, body.content, new Date().toISOString()).run();
        return Response.json({ success: true, id: id });
      }

      // API: Analyze feedback
      if (path === '/api/feedback/analyze' && request.method === 'POST') {
        await initDatabase(env.FEEDBACK_DB);
        const result = await env.FEEDBACK_DB.prepare("SELECT * FROM feedback WHERE priority IS NULL OR sentiment IS NULL").all();
        let analyzed = 0;
        
        for (const feedback of result.results) {
          const lower = feedback.content.toLowerCase();
          
          let priority = 'medium';
          let urgency = 0.5;
          if (lower.includes('urgent') || lower.includes('critical') || lower.includes('crash') || lower.includes('503')) {
            priority = 'high';
            urgency = 0.9;
          } else if (lower.includes('suggestion') || lower.includes('feature')) {
            priority = 'low';
            urgency = 0.3;
          }
          
          let sentiment = 'neutral';
          if (lower.includes('love') || lower.includes('great') || lower.includes('good')) {
            sentiment = 'positive';
          } else if (lower.includes('bad') || lower.includes('terrible') || lower.includes('frustrating')) {
            sentiment = 'negative';
          }
          
          const themes = JSON.stringify(extractThemes(lower));
          
          await env.FEEDBACK_DB.prepare(
            "UPDATE feedback SET priority = ?, urgency_score = ?, sentiment = ?, themes = ? WHERE id = ?"
          ).bind(priority, urgency, sentiment, themes, feedback.id).run();
          analyzed++;
        }
        
        return Response.json({ success: true, analyzed_count: analyzed });
      }

      // API: Get suggestions
      if (path === '/api/feedback/suggestions' && request.method === 'GET') {
        await initDatabase(env.FEEDBACK_DB);
        const result = await env.FEEDBACK_DB.prepare(
          "SELECT * FROM feedback WHERE priority IS NOT NULL ORDER BY urgency_score DESC LIMIT 10"
        ).all();
        
        const suggestions = generateSuggestionsFromFeedback(result.results);
        return Response.json({ success: true, data: suggestions });
      }

      // API: Get recommendations
      if (path === '/api/feedback/recommendations' && request.method === 'GET') {
        await initDatabase(env.FEEDBACK_DB);
        const result = await env.FEEDBACK_DB.prepare(
          "SELECT * FROM feedback WHERE priority = 'high' ORDER BY urgency_score DESC LIMIT 5"
        ).all();
        
        const recommendations = result.results.map(feedback => ({
          problem_summary: feedback.content.substring(0, 100) + (feedback.content.length > 100 ? '...' : ''),
          recommended_solution: generateSolution(feedback.content),
          priority_justification: `High priority issue with urgency score of ${Math.round(feedback.urgency_score * 100)}%`,
          estimated_effort: feedback.content.length > 200 ? 'medium' : 'small',
          suggested_team: 'Engineering'
        }));
        
        return Response.json({ success: true, data: recommendations });
      }

      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
};

// ==================== HTML CONTENT ====================
function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Analytics Hub | AI-Powered Insights</title>
    <link rel="stylesheet" href="/css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-brand">
                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                <div class="logo-text">
                    <span class="logo-title">Feedback Analytics Hub</span>
                    <span class="logo-badge">AI-Powered</span>
                </div>
            </div>
            <div class="nav-stats">
                <div class="nav-stat">
                    <span class="nav-stat-label">Last Updated</span>
                    <span class="nav-stat-value" id="lastUpdated">Just now</span>
                </div>
            </div>
        </div>
    </nav>

    <div class="container">
        <div class="hero-section">
            <div class="hero-badge">✨ Real-time Insights</div>
            <h1 class="hero-title">
                Transform Customer Feedback
                <span class="gradient-text">Into Actionable Intelligence</span>
            </h1>
            <p class="hero-subtitle">
                AI-powered analysis that automatically prioritizes, categorizes, and recommends solutions
                for your customer feedback across all channels.
            </p>
        </div>

        <div class="stats-dashboard" id="stats">
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path d="M20 12V8H4V12M20 12L4 12M20 12L22 12M4 12L2 12" stroke="currentColor" stroke-width="1.5"/>
                        <rect x="3" y="12" width="18" height="9" stroke="currentColor" stroke-width="1.5" rx="1"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-number" id="totalCount">0</div>
                    <div class="stat-label">Total Feedback</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 8V12L15 15" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-number" id="highPriorityCount">0</div>
                    <div class="stat-label">High Priority</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-number" id="negativeSentimentCount">0</div>
                    <div class="stat-label">Negative Sentiment</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path d="M9.5 2C6.5 3 4 6 4 9.5C4 13.5 7 16 11 16" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="16" cy="16" r="5" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <div class="stat-number" id="analyzedCount">0</div>
                    <div class="stat-label">Analyzed Items</div>
                </div>
            </div>
        </div>

        <div class="action-bar">
            <div class="filters-section">
                <div class="filter-group">
                    <label class="filter-label">Priority</label>
                    <select id="priorityFilter" class="filter-select">
                        <option value="all">All Priorities</option>
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Sentiment</label>
                    <select id="sentimentFilter" class="filter-select">
                        <option value="all">All Sentiments</option>
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label class="filter-label">Sort By</label>
                    <select id="sortFilter" class="filter-select">
                        <option value="recent">Most Recent</option>
                        <option value="priority">Priority (High to Low)</option>
                        <option value="urgency">Urgency Score</option>
                    </select>
                </div>
            </div>
            <div class="action-buttons">
                <button id="analyzeBtn" class="btn btn-primary">Run AI Analysis</button>
                <button id="suggestBtn" class="btn btn-warning">Generate Suggestions</button>
                <button id="refreshBtn" class="btn btn-secondary">Refresh</button>
                <button id="recommendBtn" class="btn btn-success">Get Recommendations</button>
                <button id="addTestBtn" class="btn btn-outline">Add Test Data</button>
            </div>
        </div>

        <div class="feedback-section">
            <div class="section-header">
                <h2>Aggregated Feedback</h2>
                <p>AI-analyzed feedback with priority scores and sentiment analysis</p>
            </div>
            <div id="feedbackGrid" class="feedback-grid">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading feedback data...</p>
                </div>
            </div>
        </div>

        <div id="suggestions" class="suggestions-section" style="display: none;">
            <div class="section-header">
                <h2>AI-Powered Suggestions</h2>
                <p>Actionable suggestions generated from analysis patterns</p>
            </div>
            <div id="suggestionsList" class="suggestions-list"></div>
        </div>

        <div id="recommendations" class="recommendations-section" style="display: none;">
            <div class="section-header">
                <h2>Strategic Recommendations</h2>
                <p>Data-driven recommendations for product improvement</p>
            </div>
            <div id="recommendationsList" class="recommendations-list"></div>
        </div>
    </div>

    <script src="/js/app.js"></script>
</body>
</html>`;
}

// ==================== CSS CONTENT ====================
function getCss() {
  return `:root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --primary-light: #818cf8;
    --secondary: #8b5cf6;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --dark: #1f2937;
    --gray: #6b7280;
    --gray-light: #9ca3af;
    --light: #f3f4f6;
    --white: #ffffff;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    color: var(--dark);
    line-height: 1.5;
}

.navbar {
    background: var(--white);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.95);
}

.nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.nav-brand {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo-icon {
    width: 32px;
    height: 32px;
    color: var(--primary);
}

.logo-text {
    display: flex;
    flex-direction: column;
}

.logo-title {
    font-size: 1.25rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.logo-badge {
    font-size: 0.7rem;
    color: var(--gray);
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
}

.hero-section {
    text-align: center;
    margin-bottom: 3rem;
    animation: fadeInUp 0.6s ease;
}

.hero-badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border-radius: 100px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--primary);
    margin-bottom: 1rem;
}

.hero-title {
    font-size: 3rem;
    font-weight: 800;
    margin-bottom: 1rem;
    line-height: 1.2;
}

.gradient-text {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    display: block;
}

.hero-subtitle {
    font-size: 1.125rem;
    color: var(--gray);
    max-width: 600px;
    margin: 0 auto;
}

.stats-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: var(--white);
    padding: 1.5rem;
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s ease;
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(0, 0, 0, 0.05);
    animation: fadeInUp 0.5s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.stat-icon {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary);
}

.stat-content {
    flex: 1;
}

.stat-number {
    font-size: 2rem;
    font-weight: 800;
    color: var(--dark);
    line-height: 1;
    margin-bottom: 0.25rem;
}

.stat-label {
    font-size: 0.875rem;
    color: var(--gray);
    margin-bottom: 0.25rem;
}

.action-bar {
    background: var(--white);
    padding: 1.5rem;
    border-radius: 16px;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.filters-section {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--gray);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.filter-select {
    padding: 0.5rem 2rem 0.5rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--white);
}

.filter-select:hover {
    border-color: var(--primary);
}

.action-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.btn {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: var(--white);
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-warning {
    background: linear-gradient(135deg, var(--warning), #d97706);
    color: var(--white);
}

.btn-warning:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-secondary {
    background: var(--light);
    color: var(--dark);
}

.btn-secondary:hover {
    background: #e5e7eb;
    transform: translateY(-1px);
}

.btn-success {
    background: linear-gradient(135deg, var(--success), #059669);
    color: var(--white);
}

.btn-success:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-outline {
    background: transparent;
    color: var(--gray);
    border: 1px solid #e5e7eb;
}

.btn-outline:hover {
    border-color: var(--primary);
    color: var(--primary);
}

.feedback-section {
    background: var(--white);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.section-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--light);
}

.section-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.section-header p {
    font-size: 0.875rem;
    color: var(--gray);
}

.feedback-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 1.5rem;
}

.feedback-card {
    background: var(--white);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(0, 0, 0, 0.05);
    position: relative;
    animation: fadeInUp 0.5s ease;
}

.feedback-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.priority-badge {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.priority-high {
    background: #fee2e2;
    color: var(--danger);
}

.priority-medium {
    background: #fed7aa;
    color: var(--warning);
}

.priority-low {
    background: #d1fae5;
    color: var(--success);
}

.source {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: var(--light);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary);
    margin-bottom: 1rem;
}

.content {
    color: var(--dark);
    line-height: 1.6;
    margin-bottom: 1rem;
    font-size: 0.875rem;
}

.metadata {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--light);
}

.urgency-score {
    font-size: 0.75rem;
    color: var(--gray);
    font-weight: 500;
}

.urgency-bar {
    flex: 1;
    height: 6px;
    background: var(--light);
    border-radius: 3px;
    overflow: hidden;
}

.urgency-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
    transition: width 0.3s;
}

.sentiment {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-right: 0.5rem;
}

.sentiment-positive {
    background: #d1fae5;
    color: var(--success);
}

.sentiment-negative {
    background: #fee2e2;
    color: var(--danger);
}

.sentiment-neutral {
    background: #fef3c7;
    color: var(--warning);
}

.themes {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.theme-tag {
    background: var(--light);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--gray);
    transition: all 0.2s;
}

.theme-tag:hover {
    background: var(--primary);
    color: var(--white);
    cursor: pointer;
}

.timestamp {
    font-size: 0.7rem;
    color: var(--gray-light);
    margin-top: 0.75rem;
}

.suggestions-section,
.recommendations-section {
    background: var(--white);
    border-radius: 16px;
    padding: 1.5rem;
    margin-top: 2rem;
    animation: slideUp 0.5s ease;
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.suggestions-list,
.recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.suggestion-card,
.recommendation-card {
    background: var(--light);
    border-left: 4px solid var(--primary);
    padding: 1.25rem;
    border-radius: 8px;
    transition: all 0.3s;
}

.suggestion-card:hover,
.recommendation-card:hover {
    transform: translateX(4px);
    box-shadow: var(--shadow-sm);
}

.suggestion-title,
.recommendation-title {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.75rem;
    color: var(--dark);
}

.suggestion-detail,
.recommendation-detail {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--gray);
}

.suggestion-detail strong,
.recommendation-detail strong {
    color: var(--dark);
    font-weight: 600;
    min-width: 100px;
    display: inline-block;
}

.loading-state {
    text-align: center;
    padding: 4rem;
}

.loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--light);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 768px) {
    .container {
        padding: 1rem;
    }
    
    .hero-title {
        font-size: 2rem;
    }
    
    .stats-dashboard {
        grid-template-columns: 1fr;
    }
    
    .feedback-grid {
        grid-template-columns: 1fr;
    }
    
    .action-bar {
        flex-direction: column;
        align-items: stretch;
    }
    
    .filters-section {
        flex-direction: column;
    }
    
    .action-buttons {
        justify-content: stretch;
    }
    
    .btn {
        flex: 1;
        justify-content: center;
    }
    
    .nav-container {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
}`;
}

// ==================== JAVASCRIPT CONTENT ====================
function getJs() {
  return `let allFeedback = [];

document.addEventListener('DOMContentLoaded', () => {
    loadFeedback();
    
    document.getElementById('priorityFilter').addEventListener('change', renderFeedback);
    document.getElementById('sentimentFilter').addEventListener('change', renderFeedback);
    document.getElementById('sortFilter').addEventListener('change', renderFeedback);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeAllFeedback);
    document.getElementById('suggestBtn').addEventListener('click', generateSuggestions);
    document.getElementById('refreshBtn').addEventListener('click', loadFeedback);
    document.getElementById('recommendBtn').addEventListener('click', generateRecommendations);
    document.getElementById('addTestBtn').addEventListener('click', addTestFeedback);
});

async function loadFeedback() {
    showLoading();
    try {
        const response = await fetch('/api/feedback');
        const data = await response.json();
        if (data.success) {
            allFeedback = data.data;
            updateStats();
            renderFeedback();
            updateLastUpdated();
        } else {
            showError('Failed to load feedback');
        }
    } catch (error) {
        showError('Error loading feedback: ' + error.message);
    }
}

async function addTestFeedback() {
    const testMessages = [
        "The API endpoint is returning 500 errors during peak hours, causing service disruption",
        "URGENT: Authentication service is down, users cannot log in",
        "Love the new dashboard layout, much more intuitive",
        "Documentation needs more examples for the WebSocket API",
        "Great performance improvements, page load is 3x faster",
        "Critical bug: Data corruption when processing large files",
        "The new search feature works great, found what I needed instantly",
        "Need better error messages when API rate limit is exceeded",
        "Support team was incredibly helpful in resolving my issue",
        "Feature request: Add webhook support for real-time notifications"
    ];
    
    const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
    const sources = ['Twitter', 'GitHub', 'Discord', 'Email', 'Support Ticket', 'Forum'];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: randomSource,
                content: randomMessage
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Test feedback added successfully', 'success');
            await loadFeedback();
        } else {
            showNotification('Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error adding test feedback: ' + error.message, 'error');
    }
}

function updateStats() {
    animateNumber('totalCount', 0, allFeedback.length);
    animateNumber('highPriorityCount', 0, allFeedback.filter(f => f.priority === 'high').length);
    animateNumber('negativeSentimentCount', 0, allFeedback.filter(f => f.sentiment === 'negative').length);
    animateNumber('analyzedCount', 0, allFeedback.filter(f => f.priority && f.urgency_score).length);
}

function animateNumber(elementId, start, end) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const duration = 1000;
    const step = (end - start) / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= end) {
            element.textContent = Math.round(end);
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
}

function renderFeedback() {
    const priorityFilter = document.getElementById('priorityFilter').value;
    const sentimentFilter = document.getElementById('sentimentFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;
    
    let filtered = [...allFeedback];
    
    if (priorityFilter !== 'all') {
        filtered = filtered.filter(f => f.priority === priorityFilter);
    }
    if (sentimentFilter !== 'all') {
        filtered = filtered.filter(f => f.sentiment === sentimentFilter);
    }
    
    if (sortFilter === 'recent') {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortFilter === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
    } else if (sortFilter === 'urgency') {
        filtered.sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0));
    }
    
    const grid = document.getElementById('feedbackGrid');
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="loading-state"><p>No feedback matches the filters</p></div>';
        return;
    }
    
    grid.innerHTML = filtered.map(feedback => renderFeedbackCard(feedback)).join('');
}

function renderFeedbackCard(f) {
    let themes = [];
    try {
        themes = f.themes ? JSON.parse(f.themes) : [];
    } catch(e) {
        themes = [];
    }
    
    const priority = f.priority || 'unanalyzed';
    const urgency = Math.round((f.urgency_score || 0) * 100);
    const sentiment = f.sentiment || 'neutral';
    
    let priorityClass = 'priority-medium';
    let priorityText = 'MEDIUM';
    if (priority === 'high') {
        priorityClass = 'priority-high';
        priorityText = 'HIGH';
    } else if (priority === 'low') {
        priorityClass = 'priority-low';
        priorityText = 'LOW';
    } else if (priority === 'unanalyzed') {
        priorityClass = 'priority-medium';
        priorityText = 'PENDING';
    }
    
    const sentimentIcons = {
        positive: '😊',
        neutral: '😐',
        negative: '😞'
    };
    
    return \`
        <div class="feedback-card">
            <div class="priority-badge \${priorityClass}">
                \${priorityText}
            </div>
            <div class="source">📌 \${escapeHtml(f.source || 'Unknown')}</div>
            <div class="content">\${escapeHtml(f.content)}</div>
            <div>
                <span class="sentiment sentiment-\${sentiment}">
                    \${sentimentIcons[sentiment]} \${sentiment.toUpperCase()}
                </span>
            </div>
            <div class="metadata">
                <div class="urgency-score">Urgency: \${urgency}%</div>
                <div class="urgency-bar">
                    <div class="urgency-fill" style="width: \${urgency}%"></div>
                </div>
            </div>
            \${themes.length ? \`
                <div class="themes">
                    \${themes.map(theme => \`<span class="theme-tag">\${escapeHtml(theme)}</span>\`).join('')}
                </div>
            \` : ''}
            <div class="timestamp">
                📅 \${new Date(f.created_at).toLocaleDateString()} at \${new Date(f.created_at).toLocaleTimeString()}
            </div>
        </div>
    \`;
}

async function analyzeAllFeedback() {
    const btn = document.getElementById('analyzeBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = ' Analyzing...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/analyze', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showNotification(\`Analysis complete! \${data.analyzed_count} items processed.\`, 'success');
            await loadFeedback();
        } else {
            showNotification('Error: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Error running analysis: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function generateSuggestions() {
    const btn = document.getElementById('suggestBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = ' Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/suggestions');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displaySuggestions(data.data);
            showNotification(\`Generated \${data.data.length} suggestions\`, 'success');
        } else {
            showNotification('Run AI analysis first to generate suggestions', 'info');
        }
    } catch (error) {
        showNotification('Error generating suggestions: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

async function generateRecommendations() {
    const btn = document.getElementById('recommendBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = ' Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/recommendations');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displayRecommendations(data.data);
            showNotification(\`Generated \${data.data.length} recommendations\`, 'success');
        } else {
            showNotification('Run AI analysis first to generate recommendations', 'info');
        }
    } catch (error) {
        showNotification('Error generating recommendations: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

function displaySuggestions(suggestions) {
    const section = document.getElementById('suggestions');
    const list = document.getElementById('suggestionsList');
    
    list.innerHTML = suggestions.map(sug => \`
        <div class="suggestion-card">
            <div class="suggestion-title">💡 \${escapeHtml(sug.title)}</div>
            <div class="suggestion-detail">
                <strong>Description:</strong> \${escapeHtml(sug.description)}
            </div>
            <div class="suggestion-detail">
                <strong>Impact:</strong> \${escapeHtml(sug.impact)}
            </div>
            <div class="suggestion-detail">
                <strong>Suggested Action:</strong> \${escapeHtml(sug.action)}
            </div>
            <div class="suggestion-detail">
                <strong>Priority:</strong> \${escapeHtml(sug.priority)}
            </div>
        </div>
    \`).join('');
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function displayRecommendations(recommendations) {
    const section = document.getElementById('recommendations');
    const list = document.getElementById('recommendationsList');
    
    list.innerHTML = recommendations.map(rec => \`
        <div class="recommendation-card">
            <div class="recommendation-title">🎯 \${escapeHtml(rec.problem_summary)}</div>
            <div class="recommendation-detail">
                <strong>Solution:</strong> \${escapeHtml(rec.recommended_solution)}
            </div>
            <div class="recommendation-detail">
                <strong>Priority:</strong> \${escapeHtml(rec.priority_justification)}
            </div>
            <div class="recommendation-detail">
                <strong>Effort:</strong> \${escapeHtml(rec.estimated_effort)}
            </div>
            <div class="recommendation-detail">
                <strong>Team:</strong> \${escapeHtml(rec.suggested_team)}
            </div>
        </div>
    \`).join('');
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = \`notification notification-\${type}\`;
    notification.innerHTML = message;
    notification.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: \${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    \`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    document.getElementById('feedbackGrid').innerHTML = \`
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading feedback data...</p>
        </div>
    \`;
}

function showError(message) {
    document.getElementById('feedbackGrid').innerHTML = \`
        <div class="loading-state">
            <p style="color: var(--danger);">❌ \${escapeHtml(message)}</p>
        </div>
    \`;
}

function updateLastUpdated() {
    const element = document.querySelector('.nav-stat-value');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

const style = document.createElement('style');
style.textContent = \`
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
\`;
document.head.appendChild(style);`;
}

// ==================== DATABASE FUNCTIONS ====================
async function initDatabase(db) {
  try {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS feedback (" +
      "id TEXT PRIMARY KEY, " +
      "source TEXT, " +
      "content TEXT, " +
      "sentiment TEXT, " +
      "priority TEXT, " +
      "urgency_score REAL, " +
      "themes TEXT, " +
      "created_at TEXT" +
      ")"
    );
    
    const count = await db.prepare("SELECT COUNT(*) as count FROM feedback").first();
    
    if (count.count === 0) {
      const now = new Date().toISOString();
      const mockData = [
        ['1', 'Twitter', 'The API is constantly timing out during peak hours, losing customer data. This is causing major business disruptions!', now],
        ['2', 'GitHub', 'Documentation for authentication is outdated. Spent 3 hours trying to get OAuth working.', now],
        ['3', 'Email', 'Love the new dashboard design! The analytics are much clearer now.', now],
        ['4', 'Discord', 'URGENT: Our entire team cannot log in. Getting 503 errors on all accounts.', now],
        ['5', 'Support', 'Feature request: It would be great to have webhook support for real-time notifications.', now],
        ['6', 'Twitter', 'The mobile app keeps crashing when uploading large files. Lost my work twice now.', now],
        ['7', 'GitHub', 'Great job on the performance improvements! However, there seems to be a memory leak.', now],
        ['8', 'Forum', 'Is there any plan to add GraphQL support? REST is fine but GraphQL would make complex queries easier.', now]
      ];
      
      for (const item of mockData) {
        await db.prepare(
          "INSERT INTO feedback (id, source, content, created_at) VALUES (?, ?, ?, ?)"
        ).bind(item[0], item[1], item[2], item[3]).run();
      }
    }
  } catch (err) {
    console.error('Database init error:', err);
    throw err;
  }
}

function extractThemes(lower) {
  const themes = [];
  if (lower.includes('api')) themes.push('api');
  if (lower.includes('doc')) themes.push('documentation');
  if (lower.includes('performance')) themes.push('performance');
  if (lower.includes('bug') || lower.includes('crash')) themes.push('bug');
  if (lower.includes('feature')) themes.push('feature-request');
  if (themes.length === 0) themes.push('general');
  return themes;
}

function generateSuggestionsFromFeedback(feedbackList) {
  const suggestions = [];
  const themes = {};
  
  feedbackList.forEach(f => {
    try {
      const themesList = JSON.parse(f.themes);
      themesList.forEach(theme => {
        themes[theme] = (themes[theme] || 0) + 1;
      });
    } catch(e) {}
  });
  
  if (themes['api'] > 2) {
    suggestions.push({
      title: 'API Reliability Improvements',
      description: 'Multiple API-related issues detected across feedback.',
      impact: 'High - Affects customer experience and system reliability',
      action: 'Conduct API performance audit, add monitoring, and implement circuit breakers',
      priority: 'High'
    });
  }
  
  if (themes['documentation'] > 1) {
    suggestions.push({
      title: 'Documentation Enhancement',
      description: 'Customers are struggling with documentation clarity.',
      impact: 'Medium - Increases support tickets and onboarding time',
      action: 'Review and update documentation with more examples and tutorials',
      priority: 'Medium'
    });
  }
  
  if (themes['performance'] > 1) {
    suggestions.push({
      title: 'Performance Optimization',
      description: 'Performance concerns raised by multiple users.',
      impact: 'High - Directly impacts user satisfaction',
      action: 'Run performance profiling and optimize critical paths',
      priority: 'High'
    });
  }
  
  if (themes['bug'] > 2) {
    suggestions.push({
      title: 'Bug Triage and Fixing',
      description: 'Multiple bug reports requiring attention.',
      impact: 'High - Affects product stability',
      action: 'Prioritize bug fixes and improve testing coverage',
      priority: 'High'
    });
  }
  
  if (themes['feature-request'] > 1) {
    suggestions.push({
      title: 'Feature Roadmap Planning',
      description: 'Common feature requests from customers.',
      impact: 'Medium - Opportunity for product differentiation',
      action: 'Evaluate top requested features for next quarter roadmap',
      priority: 'Medium'
    });
  }
  
  return suggestions;
}

function generateSolution(content) {
  const lower = content.toLowerCase();
  if (lower.includes('api') && lower.includes('timeout')) {
    return 'Investigate API performance bottlenecks, add connection pooling, and implement retry logic with exponential backoff.';
  } else if (lower.includes('documentation')) {
    return 'Review and update documentation with more examples and troubleshooting guides.';
  } else if (lower.includes('login') || lower.includes('503')) {
    return 'URGENT: Investigate authentication service stability and add additional monitoring.';
  } else if (lower.includes('crash')) {
    return 'Investigate app stability, add crash reporting, and prioritize fixes.';
  } else if (lower.includes('feature')) {
    return 'Evaluate feature request for roadmap planning and prioritization.';
  } else {
    return 'Investigate the reported issue and prioritize based on impact.';
  }
}