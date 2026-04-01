let allFeedback = [];

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
    
    return `
        <div class="feedback-card">
            <div class="priority-badge ${priorityClass}">
                ${priorityText}
            </div>
            <div class="source">📌 ${escapeHtml(f.source || 'Unknown')}</div>
            <div class="content">${escapeHtml(f.content)}</div>
            <div>
                <span class="sentiment sentiment-${sentiment}">
                    ${sentimentIcons[sentiment]} ${sentiment.toUpperCase()}
                </span>
            </div>
            <div class="metadata">
                <div class="urgency-score">Urgency: ${urgency}%</div>
                <div class="urgency-bar">
                    <div class="urgency-fill" style="width: ${urgency}%"></div>
                </div>
            </div>
            ${themes.length ? `
                <div class="themes">
                    ${themes.map(theme => `<span class="theme-tag">${escapeHtml(theme)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="timestamp">
                📅 ${new Date(f.created_at).toLocaleDateString()} at ${new Date(f.created_at).toLocaleTimeString()}
            </div>
        </div>
    `;
}

async function analyzeAllFeedback() {
    const btn = document.getElementById('analyzeBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2"/></svg> Analyzing...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/analyze', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Analysis complete! ${data.analyzed_count} items processed.`, 'success');
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
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8V12L15 15" stroke="currentColor" stroke-width="2"/></svg> Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/suggestions');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displaySuggestions(data.data);
            showNotification(`Generated ${data.data.length} suggestions`, 'success');
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
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L15 8H22L16 12L19 18L12 14L5 18L8 12L2 8H9L12 2Z" stroke="currentColor" stroke-width="1.5"/></svg> Generating...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/feedback/recommendations');
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            displayRecommendations(data.data);
            showNotification(`Generated ${data.data.length} recommendations`, 'success');
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
    
    list.innerHTML = suggestions.map(sug => `
        <div class="suggestion-card">
            <div class="suggestion-title">💡 ${escapeHtml(sug.title)}</div>
            <div class="suggestion-detail">
                <strong>Description:</strong> ${escapeHtml(sug.description)}
            </div>
            <div class="suggestion-detail">
                <strong>Impact:</strong> ${escapeHtml(sug.impact)}
            </div>
            <div class="suggestion-detail">
                <strong>Suggested Action:</strong> ${escapeHtml(sug.action)}
            </div>
            <div class="suggestion-detail">
                <strong>Priority:</strong> ${escapeHtml(sug.priority)}
            </div>
        </div>
    `).join('');
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function displayRecommendations(recommendations) {
    const section = document.getElementById('recommendations');
    const list = document.getElementById('recommendationsList');
    
    list.innerHTML = recommendations.map(rec => `
        <div class="recommendation-card">
            <div class="recommendation-title">🎯 ${escapeHtml(rec.problem_summary)}</div>
            <div class="recommendation-detail">
                <strong>Solution:</strong> ${escapeHtml(rec.recommended_solution)}
            </div>
            <div class="recommendation-detail">
                <strong>Priority:</strong> ${escapeHtml(rec.priority_justification)}
            </div>
            <div class="recommendation-detail">
                <strong>Effort:</strong> ${escapeHtml(rec.estimated_effort)}
            </div>
            <div class="recommendation-detail">
                <strong>Team:</strong> ${escapeHtml(rec.suggested_team)}
            </div>
        </div>
    `).join('');
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
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
    document.getElementById('feedbackGrid').innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading feedback data...</p>
        </div>
    `;
}

function showError(message) {
    document.getElementById('feedbackGrid').innerHTML = `
        <div class="loading-state">
            <p style="color: var(--danger);">❌ ${escapeHtml(message)}</p>
        </div>
    `;
}

function updateLastUpdated() {
    const element = document.querySelector('.nav-stat-value');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

const style = document.createElement('style');
style.textContent = `
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
`;
document.head.appendChild(style);
