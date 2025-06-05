(function (exports) {
    'use strict';

    class FairydustAPI {
        constructor(config) {
            this.config = config;
            this.baseUrl = config.apiUrl.replace(/\/$/, '');
        }
        async request(endpoint, options = {}) {
            const url = `${this.baseUrl}${endpoint}`;
            const token = this.getAccessToken();
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers,
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(url, {
                ...options,
                headers,
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: 'Network error'
                }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            return response.json();
        }
        getAccessToken() {
            return localStorage.getItem(`fairydust_${this.config.appId}_access_token`);
        }
        setTokens(accessToken, refreshToken) {
            localStorage.setItem(`fairydust_${this.config.appId}_access_token`, accessToken);
            localStorage.setItem(`fairydust_${this.config.appId}_refresh_token`, refreshToken);
        }
        clearTokens() {
            localStorage.removeItem(`fairydust_${this.config.appId}_access_token`);
            localStorage.removeItem(`fairydust_${this.config.appId}_refresh_token`);
        }
        // Authentication methods
        async requestOTP(request) {
            return this.request('/auth/otp/request', {
                method: 'POST',
                body: JSON.stringify(request),
            });
        }
        async verifyOTP(request) {
            const response = await this.request('/auth/otp/verify', {
                method: 'POST',
                body: JSON.stringify(request),
            });
            // Store tokens
            this.setTokens(response.token.access_token, response.token.refresh_token);
            return response;
        }
        async refreshToken() {
            const refreshToken = localStorage.getItem(`fairydust_${this.config.appId}_refresh_token`);
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            const response = await this.request('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            this.setTokens(response.access_token, response.refresh_token);
            return response;
        }
        async logout() {
            try {
                await this.request('/auth/logout', {
                    method: 'POST',
                });
            }
            finally {
                this.clearTokens();
            }
        }
        // User methods
        async getCurrentUser() {
            return this.request('/users/me');
        }
        async getUserBalance() {
            return this.request('/users/me/balance');
        }
        // Transaction methods
        async consumeDust(amount, description) {
            // Call ledger service for transactions
            let ledgerUrl;
            if (this.config.ledgerUrl) {
                ledgerUrl = this.config.ledgerUrl.replace(/\/$/, '');
            }
            else {
                ledgerUrl = this.baseUrl.replace(':8001', ':8002');
            }
            // Get current user to extract user_id
            const user = await this.getCurrentUser();
            // Generate idempotency key
            const idempotencyKey = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const response = await fetch(`${ledgerUrl}/transactions/consume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAccessToken()}`
                },
                body: JSON.stringify({
                    user_id: user.id,
                    amount,
                    action: description,
                    app_id: this.config.appId,
                    idempotency_key: idempotencyKey
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: 'Network error'
                }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            return response.json();
        }
        async getTransactions() {
            return this.request('/transactions');
        }
        // Payment methods
        async purchaseDust(request) {
            return this.request('/payments/purchase', {
                method: 'POST',
                body: JSON.stringify(request),
            });
        }
        async getPaymentMethods() {
            return this.request('/payments/methods');
        }
        // Utility methods
        isAuthenticated() {
            return !!this.getAccessToken();
        }
        async checkConnection() {
            try {
                await this.getCurrentUser();
                return true;
            }
            catch {
                return false;
            }
        }
    }

    class AuthenticationComponent {
        constructor(api, container, props) {
            this.currentStep = 'input';
            this.identifier = '';
            this.identifierType = 'email';
            this.api = api;
            this.container = container;
            this.props = props;
            this.render();
        }
        render() {
            if (this.currentStep === 'input') {
                this.renderIdentifierInput();
            }
            else {
                this.renderOTPInput();
            }
        }
        renderIdentifierInput() {
            this.container.innerHTML = `
      <div class="fairydust-modal-content">
        <button class="fairydust-close">&times;</button>
        <div class="fairydust-auth">
          <h2>Connect with fairydust</h2>
          <p><strong>${this.props.appName}</strong> uses fairydust to help cover AI costs. New users get 25 dust for free by providing phone or email.</p>
          
          <form class="fairydust-form" data-testid="auth-form">
            <div>
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                Sign up or log in
              </label>
              <input 
                type="text" 
                class="fairydust-input" 
                placeholder="Enter email or phone number"
                data-testid="identifier-input"
                required
              />
            </div>
            
            <button type="submit" class="fairydust-button-primary" data-testid="submit-button">
              Continue
            </button>
            
            <div class="fairydust-error" style="display: none;" data-testid="error-message"></div>
          </form>
        </div>
      </div>
    `;
            this.attachIdentifierEvents();
            // Auto-focus the input
            setTimeout(() => {
                const input = this.container.querySelector('.fairydust-input');
                if (input)
                    input.focus();
            }, 100);
        }
        renderOTPInput() {
            this.container.innerHTML = `
      <div class="fairydust-modal-content">
        <button class="fairydust-close">&times;</button>
        <div class="fairydust-auth">
          <h2>Enter Verification Code</h2>
          <p>We've sent a 6-digit code to <strong>${this.identifier}</strong></p>
          
          <form class="fairydust-form" data-testid="otp-form">
            <div>
              <input 
                type="text" 
                class="fairydust-input fairydust-otp-input" 
                placeholder="000000"
                maxlength="6"
                pattern="[0-9]{6}"
                data-testid="otp-input"
                required
              />
            </div>
            
            <button type="submit" class="fairydust-button-primary" data-testid="verify-button">
              Verify
            </button>
            
            <button type="button" class="fairydust-button-secondary" data-testid="back-button">
              Use Different ${this.identifierType === 'email' ? 'Email' : 'Phone'}
            </button>
            
            <div class="fairydust-error" style="display: none;" data-testid="error-message"></div>
          </form>
        </div>
      </div>
    `;
            this.attachOTPEvents();
            // Auto-focus the OTP input
            setTimeout(() => {
                const input = this.container.querySelector('.fairydust-otp-input');
                if (input)
                    input.focus();
            }, 100);
        }
        attachIdentifierEvents() {
            const form = this.container.querySelector('[data-testid="auth-form"]');
            const input = this.container.querySelector('[data-testid="identifier-input"]');
            const submitBtn = this.container.querySelector('[data-testid="submit-button"]');
            const errorDiv = this.container.querySelector('[data-testid="error-message"]');
            const closeBtn = this.container.querySelector('.fairydust-close');
            // Auto-focus
            input.focus();
            // Close events
            closeBtn.addEventListener('click', () => this.props.onCancel?.());
            this.container.addEventListener('click', (e) => {
                if (e.target === this.container) {
                    this.props.onCancel?.();
                }
            });
            // Form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const value = input.value.trim();
                if (!value)
                    return;
                this.identifier = value;
                this.identifierType = this.detectIdentifierType(value);
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Sending...';
                    await this.api.requestOTP({
                        identifier: this.identifier,
                        identifier_type: this.identifierType
                    });
                    this.currentStep = 'otp';
                    this.render();
                }
                catch (error) {
                    this.showError(errorDiv, error instanceof Error ? error.message : 'Failed to send verification code');
                }
                finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Continue';
                }
            });
        }
        attachOTPEvents() {
            const form = this.container.querySelector('[data-testid="otp-form"]');
            const input = this.container.querySelector('[data-testid="otp-input"]');
            const verifyBtn = this.container.querySelector('[data-testid="verify-button"]');
            const backBtn = this.container.querySelector('[data-testid="back-button"]');
            const errorDiv = this.container.querySelector('[data-testid="error-message"]');
            const closeBtn = this.container.querySelector('.fairydust-close');
            // Auto-focus
            input.focus();
            // Close events
            closeBtn.addEventListener('click', () => this.props.onCancel?.());
            this.container.addEventListener('click', (e) => {
                if (e.target === this.container) {
                    this.props.onCancel?.();
                }
            });
            // Back button
            backBtn.addEventListener('click', () => {
                this.currentStep = 'input';
                this.render();
            });
            // OTP input formatting
            input.addEventListener('input', (e) => {
                const target = e.target;
                const value = target.value.replace(/\D/g, ''); // Only digits
                target.value = value;
                // Auto-submit when 6 digits entered
                if (value.length === 6) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
            // Form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = input.value.trim();
                if (code.length !== 6) {
                    this.showError(errorDiv, 'Please enter a 6-digit code');
                    return;
                }
                try {
                    verifyBtn.disabled = true;
                    verifyBtn.textContent = 'Verifying...';
                    const authResponse = await this.api.verifyOTP({
                        identifier: this.identifier,
                        code
                    });
                    this.props.onSuccess?.(authResponse);
                }
                catch (error) {
                    this.showError(errorDiv, error instanceof Error ? error.message : 'Invalid verification code');
                    input.value = '';
                    input.focus();
                }
                finally {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify';
                }
            });
        }
        detectIdentifierType(value) {
            // Simple email pattern
            if (value.includes('@') && value.includes('.')) {
                return 'email';
            }
            // Assume phone if it starts with + or contains only digits/spaces/dashes
            return 'phone';
        }
        showError(errorDiv, message) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            // Hide error after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }

    class AccountComponent {
        constructor(api, container, props = {}) {
            this.user = null;
            this.isConnected = false;
            this.api = api;
            this.container = container;
            this.props = props;
            this.init();
        }
        async init() {
            try {
                if (this.api.isAuthenticated()) {
                    this.user = await this.api.getCurrentUser();
                    this.isConnected = true;
                    this.props.onConnect?.(this.user);
                }
            }
            catch (error) {
                console.error('Failed to load user:', error);
                this.isConnected = false;
            }
            this.render();
        }
        render() {
            const fairy = '🧚‍♀️';
            const balance = this.isConnected ? this.user?.dust_balance || 0 : 0;
            const stateClass = this.isConnected ? 'connected' : 'disconnected';
            this.container.innerHTML = `
      <div class="fairydust-account ${stateClass}" data-testid="fairydust-account">
        <span class="fairydust-fairy">${fairy}</span>
        <span class="fairydust-balance">${balance}</span>
      </div>
    `;
            const element = this.container.querySelector('.fairydust-account');
            element.addEventListener('click', () => this.handleClick());
        }
        handleClick() {
            if (this.isConnected && this.user) {
                this.showAccountDetails();
            }
            else {
                this.showAuthentication();
            }
        }
        showAccountDetails() {
            if (!this.user)
                return;
            const modal = this.createModal();
            modal.innerHTML = `
      <div class="fairydust-modal-content">
        <button class="fairydust-close">&times;</button>
        <div class="fairydust-account-details">
          <div class="fairydust-fairyname">${this.user.fairyname}</div>
          <div class="fairydust-balance-large">${this.user.dust_balance} <span style="font-size: 16px;">DUST</span></div>
          <div class="fairydust-actions">
            <button class="fairydust-button-primary" data-action="buy-dust">Buy More Dust</button>
            <button class="fairydust-button-secondary" data-action="visit-site">Visit fairydust.fun</button>
            <button class="fairydust-button-secondary" data-action="disconnect">Disconnect Account</button>
          </div>
        </div>
      </div>
    `;
            this.attachModalEvents(modal);
            document.body.appendChild(modal);
        }
        showAuthentication() {
            const modal = this.createModal();
            // Create authentication component
            new AuthenticationComponent(this.api, modal, {
                appName: document.title || 'This App',
                onSuccess: (authResponse) => {
                    this.user = authResponse.user;
                    this.isConnected = true;
                    this.render();
                    this.props.onConnect?.(this.user);
                    this.props.onBalanceUpdate?.(this.user.dust_balance);
                    this.closeModal(modal);
                },
                onCancel: () => {
                    this.closeModal(modal);
                }
            });
            document.body.appendChild(modal);
        }
        createModal() {
            const modal = document.createElement('div');
            modal.className = 'fairydust-modal';
            return modal;
        }
        attachModalEvents(modal) {
            // Close button
            const closeBtn = modal.querySelector('.fairydust-close');
            closeBtn?.addEventListener('click', () => this.closeModal(modal));
            // Modal background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
            // Action buttons
            modal.addEventListener('click', async (e) => {
                const target = e.target;
                const action = target.getAttribute('data-action');
                switch (action) {
                    case 'buy-dust':
                        this.showPurchaseFlow(modal);
                        break;
                    case 'visit-site':
                        window.open('https://fairydust.fun', '_blank');
                        break;
                    case 'disconnect':
                        await this.disconnect();
                        this.closeModal(modal);
                        break;
                }
            });
            // Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal(modal);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
        showPurchaseFlow(modal) {
            // TODO: Implement purchase flow
            // For now, redirect to fairydust.fun
            window.open('https://fairydust.fun/purchase', '_blank');
        }
        async disconnect() {
            try {
                await this.api.logout();
                this.user = null;
                this.isConnected = false;
                this.render();
                this.props.onDisconnect?.();
            }
            catch (error) {
                console.error('Failed to disconnect:', error);
            }
        }
        closeModal(modal) {
            modal.remove();
        }
        // Public methods
        async refresh() {
            // Always check authentication state on refresh, not just when already connected
            try {
                if (this.api.isAuthenticated()) {
                    const wasConnected = this.isConnected;
                    this.user = await this.api.getCurrentUser();
                    this.isConnected = true;
                    this.render();
                    this.props.onBalanceUpdate?.(this.user.dust_balance);
                    // If we just became connected, notify the callback
                    if (!wasConnected) {
                        this.props.onConnect?.(this.user);
                    }
                }
                else {
                    // Not authenticated
                    this.user = null;
                    this.isConnected = false;
                    this.render();
                }
            }
            catch (error) {
                console.error('Failed to refresh user:', error);
                // If we get an error (like 401), clear the connection state
                this.user = null;
                this.isConnected = false;
                this.render();
            }
        }
        getUser() {
            return this.user;
        }
        isUserConnected() {
            return this.isConnected;
        }
    }

    class ButtonComponent {
        constructor(api, container, props) {
            this.user = null;
            this.isConnected = false;
            this.api = api;
            this.container = container;
            this.props = props;
            this.init();
        }
        async init() {
            try {
                if (this.api.isAuthenticated()) {
                    this.user = await this.api.getCurrentUser();
                    this.isConnected = true;
                }
            }
            catch (error) {
                console.error('Failed to load user:', error);
                this.isConnected = false;
            }
            this.render();
        }
        render() {
            const fairy = '🧚‍♀️';
            const disabled = this.props.disabled ? 'disabled' : '';
            const className = `fairydust-button ${this.props.className || ''} ${disabled}`.trim();
            // Use label if provided, otherwise fall back to children
            const buttonText = this.props.label || this.props.children;
            this.container.innerHTML = `
      <button type="button" class="${className}" data-testid="fairydust-button" ${disabled}>
        <span>${buttonText}</span>
        <div class="fairydust-button-dust">
          <span class="fairydust-fairy">${fairy}</span>
          <span>${this.props.dustCost}</span>
        </div>
      </button>
    `;
            const button = this.container.querySelector('button');
            button.addEventListener('click', () => this.handleClick());
        }
        async handleClick() {
            if (this.props.disabled)
                return;
            try {
                // Check authentication status fresh each time
                if (!this.api.isAuthenticated()) {
                    this.showAuthentication();
                    return;
                }
                // Try to refresh user data to get latest balance
                // If this fails with 401, the token is invalid and we need to re-authenticate
                try {
                    this.user = await this.api.getCurrentUser();
                    this.isConnected = true;
                }
                catch (authError) {
                    // If we get a 401, the token is expired/invalid - show authentication
                    if (authError.message && authError.message.includes('401')) {
                        // Clear invalid tokens
                        this.api.clearTokens();
                        this.showAuthentication();
                        return;
                    }
                    // Re-throw other errors
                    throw authError;
                }
                // Check if user has sufficient balance
                if (this.user.dust_balance < this.props.dustCost) {
                    this.showInsufficientBalance();
                    return;
                }
                // Check if user has disabled confirmations
                const skipConfirmations = localStorage.getItem(`fairydust_${this.api.config.appId}_skip_confirmations`) === 'true';
                if (skipConfirmations) {
                    // Direct payment without confirmation
                    this.animateButton();
                    const transaction = await this.api.consumeDust(this.props.dustCost, `${this.props.children} - ${document.title || 'App'}`);
                    // Update user balance
                    if (this.user) {
                        this.user.dust_balance -= this.props.dustCost;
                    }
                    this.props.onSuccess?.(transaction);
                }
                else {
                    // Show confirmation modal
                    this.showConfirmation();
                }
            }
            catch (error) {
                console.error('Button click error:', error);
                this.props.onError?.(error instanceof Error ? error.message : 'An error occurred');
            }
        }
        showAuthentication() {
            const modal = this.createModal();
            new AuthenticationComponent(this.api, modal, {
                appName: document.title || 'This App',
                onSuccess: async (authResponse) => {
                    this.user = authResponse.user;
                    this.isConnected = true;
                    this.closeModal(modal);
                    // After authentication, check balance and proceed
                    if (this.user.dust_balance >= this.props.dustCost) {
                        this.showConfirmation();
                    }
                    else {
                        this.showInsufficientBalance();
                    }
                },
                onCancel: () => {
                    this.closeModal(modal);
                }
            });
            document.body.appendChild(modal);
        }
        showConfirmation() {
            if (!this.user)
                return;
            const modal = this.createModal();
            modal.innerHTML = `
      <div class="fairydust-modal-content">
        <button class="fairydust-close">&times;</button>
        <div class="fairydust-confirmation">
          <h3>Confirm Action</h3>
          <p>This action will consume:</p>
          <div class="fairydust-dust-amount">${this.props.dustCost} <span style="font-size: 24px;">DUST</span></div>
          <div class="fairydust-current-balance">
            Your current balance: <strong>${this.user.dust_balance} DUST</strong>
          </div>
          <div style="margin: 16px 0; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; text-align: center;">
            <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; white-space: nowrap;">
              <input type="checkbox" id="skip-confirmations" style="margin: 0;">
              <span>Skip confirmations</span>
            </label>
          </div>
          <div class="fairydust-actions">
            <button class="fairydust-button-primary" data-action="confirm">
              Confirm
            </button>
            <button class="fairydust-button-secondary" data-action="cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
            this.attachConfirmationEvents(modal);
            document.body.appendChild(modal);
        }
        showInsufficientBalance() {
            if (!this.user)
                return;
            const needed = this.props.dustCost - this.user.dust_balance;
            const modal = this.createModal();
            modal.innerHTML = `
      <div class="fairydust-modal-content">
        <button class="fairydust-close">&times;</button>
        <div class="fairydust-confirmation">
          <h3>Insufficient Dust</h3>
          <p>You need <strong>${this.props.dustCost} DUST</strong> but only have <strong>${this.user.dust_balance} DUST</strong></p>
          <div class="fairydust-dust-amount">+${needed} <span style="font-size: 24px;">DUST needed</span></div>
          <div class="fairydust-actions">
            <button class="fairydust-button-primary" data-action="buy-dust">
              Buy More Dust
            </button>
            <button class="fairydust-button-secondary" data-action="cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
            this.attachInsufficientBalanceEvents(modal);
            document.body.appendChild(modal);
        }
        attachConfirmationEvents(modal) {
            this.attachModalEvents(modal);
            modal.addEventListener('click', async (e) => {
                const target = e.target;
                const action = target.getAttribute('data-action');
                switch (action) {
                    case 'confirm':
                        // Check if user wants to skip future confirmations
                        const checkbox = modal.querySelector('#skip-confirmations');
                        if (checkbox?.checked) {
                            localStorage.setItem(`fairydust_${this.api.config.appId}_skip_confirmations`, 'true');
                        }
                        await this.consumeDust(modal);
                        break;
                    case 'cancel':
                        this.closeModal(modal);
                        break;
                }
            });
        }
        attachInsufficientBalanceEvents(modal) {
            this.attachModalEvents(modal);
            modal.addEventListener('click', (e) => {
                const target = e.target;
                const action = target.getAttribute('data-action');
                switch (action) {
                    case 'buy-dust':
                        // TODO: Implement purchase flow
                        window.open('https://fairydust.fun/purchase', '_blank');
                        this.closeModal(modal);
                        break;
                    case 'cancel':
                        this.closeModal(modal);
                        break;
                }
            });
        }
        async consumeDust(modal) {
            try {
                const confirmBtn = modal.querySelector('[data-action="confirm"]');
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Processing...';
                // Animate button
                this.animateButton();
                const transaction = await this.api.consumeDust(this.props.dustCost, `${this.props.children} - ${document.title || 'App'}`);
                // Update user balance
                if (this.user) {
                    this.user.dust_balance -= this.props.dustCost;
                }
                this.closeModal(modal);
                this.props.onSuccess?.(transaction);
            }
            catch (error) {
                console.error('Failed to consume dust:', error);
                this.props.onError?.(error instanceof Error ? error.message : 'Failed to process payment');
            }
        }
        animateButton() {
            const button = this.container.querySelector('button');
            button.classList.add('loading');
            // Keep spinning fairy for the entire process - no jarring scale animation
            setTimeout(() => {
                button.classList.remove('loading');
            }, 1500);
        }
        createModal() {
            const modal = document.createElement('div');
            modal.className = 'fairydust-modal';
            return modal;
        }
        attachModalEvents(modal) {
            // Close button
            const closeBtn = modal.querySelector('.fairydust-close');
            closeBtn?.addEventListener('click', () => this.closeModal(modal));
            // Modal background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
            // Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal(modal);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
        closeModal(modal) {
            modal.remove();
        }
        // Public methods
        async refresh() {
            if (this.isConnected) {
                try {
                    this.user = await this.api.getCurrentUser();
                }
                catch (error) {
                    console.error('Failed to refresh user:', error);
                }
            }
        }
        updateProps(props) {
            this.props = { ...this.props, ...props };
            this.render();
        }
        getUser() {
            return this.user;
        }
    }

    /**
     * Fairydust Simple Integration (Standalone)
     *
     * Usage:
     * <link rel="stylesheet" href="https://fairydust.fun/sdk/fairydust.css">
     * <script src="https://fairydust.fun/sdk/simple.js?app=YOUR_APP_ID"></script>
     * <button class="fairydust-button" data-cost="5" onclick="yourFunction()">Pay with Dust</button>
     */
    // Import without CSS to avoid build issues
    class Fairydust {
        constructor(config) {
            this.accountComponents = [];
            this.config = config;
            this.api = new FairydustAPI(config);
            if (config.debug) {
                console.log('Fairydust SDK initialized:', config);
            }
        }
        // Core API access
        getAPI() {
            return this.api;
        }
        // Authentication state
        async getAuthState() {
            if (!this.api.isAuthenticated()) {
                return { isConnected: false };
            }
            try {
                const user = await this.api.getCurrentUser();
                return {
                    isConnected: true,
                    user
                };
            }
            catch (error) {
                return { isConnected: false };
            }
        }
        // Component creation methods
        createAccountComponent(selector, props = {}) {
            const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            const component = new AccountComponent(element, this.api, props);
            this.accountComponents.push(component);
            return component;
        }
        createButtonComponent(selector, props) {
            const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            const component = new ButtonComponent(element, this.api, props);
            return component;
        }
        createAuthenticationComponent(selector, props) {
            const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            const component = new AuthenticationComponent(element, this.api, props);
            return component;
        }
        // Manual refresh method for account components
        async refreshAccountComponents() {
            for (const component of this.accountComponents) {
                await component.refreshState();
            }
        }
    }
    // Get app ID from script tag
    function getAppIdFromScript() {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src && src.includes('fairydust') && src.includes('app=')) {
                const urlParams = new URLSearchParams(src.split('?')[1]);
                return urlParams.get('app');
            }
        }
        return null;
    }
    // Initialize on load
    if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', () => {
            const appId = getAppIdFromScript();
            if (!appId) {
                console.error('[Fairydust] No app ID found. Add ?app=YOUR_APP_ID to the script URL');
                return;
            }
            // Initialize Fairydust
            const fairydust = new Fairydust({
                appId,
                apiUrl: 'https://api.fairydust.fun',
                ledgerUrl: 'https://ledger.fairydust.fun'
            });
            // Store instance globally for optional advanced usage
            window.fairydust = fairydust;
            // Auto-enhance all buttons with class "fairydust-button"
            const enhanceButtons = () => {
                const buttons = document.querySelectorAll('button.fairydust-button');
                buttons.forEach((button) => {
                    const btn = button;
                    // Skip if already enhanced
                    if (btn.dataset.fairydustEnhanced === 'true')
                        return;
                    // Get cost from data attribute
                    const cost = parseInt(btn.dataset.cost || '1');
                    // Store original onclick
                    const originalOnclick = btn.onclick;
                    // Create wrapper div
                    const wrapper = document.createElement('div');
                    wrapper.className = 'fairydust-button-wrapper';
                    wrapper.style.display = 'inline-block';
                    // Insert wrapper and move button into it
                    btn.parentNode?.insertBefore(wrapper, btn);
                    wrapper.appendChild(btn);
                    // Hide original button
                    btn.style.display = 'none';
                    // Create Fairydust button in wrapper
                    fairydust.createButtonComponent(wrapper, {
                        dustCost: cost,
                        children: btn.innerHTML,
                        disabled: btn.disabled,
                        onSuccess: async (transaction) => {
                            // Call original onclick if it exists
                            if (originalOnclick) {
                                originalOnclick.call(btn, new MouseEvent('click', { bubbles: true }));
                            }
                            // The main SDK automatically refreshes account components after successful payments
                            // Also dispatch a custom event for flexibility
                            btn.dispatchEvent(new CustomEvent('fairydust:success', {
                                detail: { transaction },
                                bubbles: true
                            }));
                        },
                        onError: (error) => {
                            console.error('[Fairydust] Payment failed:', error);
                            btn.dispatchEvent(new CustomEvent('fairydust:error', {
                                detail: { error },
                                bubbles: true
                            }));
                        }
                    });
                    // Mark as enhanced
                    btn.dataset.fairydustEnhanced = 'true';
                    // Watch for disabled state changes
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.attributeName === 'disabled') {
                                // Re-render the button with new disabled state
                                fairydust.createButtonComponent(wrapper, {
                                    dustCost: cost,
                                    children: btn.innerHTML,
                                    disabled: btn.disabled,
                                    onSuccess: async (transaction) => {
                                        if (originalOnclick) {
                                            originalOnclick.call(btn, new MouseEvent('click', { bubbles: true }));
                                        }
                                        btn.dispatchEvent(new CustomEvent('fairydust:success', {
                                            detail: { transaction },
                                            bubbles: true
                                        }));
                                    }
                                });
                            }
                        });
                    });
                    observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
                });
            };
            // Enhance buttons on load
            enhanceButtons();
            // Also support dynamically added buttons
            const observer = new MutationObserver(() => {
                enhanceButtons();
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            // Optional: Add account widget if element exists
            const accountElement = document.getElementById('fairydust-account');
            if (accountElement) {
                fairydust.createAccountComponent(accountElement, {
                    onConnect: (user) => {
                        console.log('[Fairydust] User connected:', user);
                    },
                    onDisconnect: () => {
                        console.log('[Fairydust] User disconnected');
                    }
                });
            }
            console.log('[Fairydust] Ready! App ID:', appId);
        });
    }

    exports.Fairydust = Fairydust;

    return exports;

})({});
//# sourceMappingURL=simple.js.map
