const axios = require('axios');

class HubitatClient {
    constructor(config = {}) {
        this.ip = config.ip || '';
        this.appId = config.appId || '';
        this.baseUrl = this.ip && this.appId ? `http://${this.ip}/apps/api/${this.appId}` : '';
        this.accessToken = config.accessToken || config.token || '';
        this.hubUsername = config.hubUsername || '';
        this.hubPassword = config.hubPassword || '';
        this.sessionCookie = null;
    }

    isConfigured() {
        return !!(this.ip && this.appId && this.accessToken);
    }

    async getDevices() {
        if (!this.isConfigured()) {
            return [];
        }
        try {
            const response = await axios.get(`${this.baseUrl}/devices`, {
                params: { access_token: this.accessToken },
                timeout: 8000
            });
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error('Error fetching devices from Hubitat:', error.message);
            throw error;
        }
    }

    async getDeviceDetails(deviceId) {
        if (!this.isConfigured()) {
            throw new Error('Hubitat Maker API is not configured');
        }
        try {
            const response = await axios.get(`${this.baseUrl}/devices/${deviceId}`, {
                params: { access_token: this.accessToken },
                timeout: 8000
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching details for device ${deviceId}:`, error.message);
            throw error;
        }
    }

    async sendCommand(deviceId, command, secondary = '') {
        if (!this.isConfigured()) {
            throw new Error('Hubitat Maker API is not configured');
        }
        try {
            const url = `${this.baseUrl}/devices/${deviceId}/${command}${secondary ? `/${secondary}` : ''}`;
            const response = await axios.get(url, {
                params: { access_token: this.accessToken },
                timeout: 8000
            });
            return response.data;
        } catch (error) {
            console.error(`Error sending command ${command} to device ${deviceId}:`, error.message);
            throw error;
        }
    }

    // Hub Local Admin Authentication (Cookie based)
    async login() {
        if (!this.hubUsername || !this.hubPassword) {
            return false;
        }
        try {
            const params = new URLSearchParams();
            params.append('username', this.hubUsername);
            params.append('password', this.hubPassword);
            params.append('submit', 'Login');

            const res = await axios.post(`http://${this.ip}/login`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });

            const cookies = res.headers['set-cookie'];
            if (cookies) {
                this.sessionCookie = cookies.map(c => c.split(';')[0]).join('; ');
                return true;
            }
            return false;
        } catch (err) {
            console.warn('Hubitat admin login error or not required:', err.message);
            return false;
        }
    }

    // Start Zigbee Discovery (Pairing mode)
    async startZigbeePairing(seconds = 60) {
        if (!this.ip) throw new Error('Hubitat IP not configured');
        try {
            await this.login();
            const headers = this.sessionCookie ? { Cookie: this.sessionCookie } : {};
            const res = await axios.post(`http://${this.ip}/hub/zigbee/discover`, null, {
                headers,
                timeout: 5000
            });
            return { success: true, mode: 'zigbee', duration: seconds, data: res.data };
        } catch (err) {
            // Some hub firmware versions accept direct GET/POST without auth if LAN login security is off
            return { success: false, error: err.message };
        }
    }

    // Stop Zigbee Discovery
    async stopZigbeePairing() {
        if (!this.ip) throw new Error('Hubitat IP not configured');
        try {
            await this.login();
            const headers = this.sessionCookie ? { Cookie: this.sessionCookie } : {};
            await axios.post(`http://${this.ip}/hub/zigbee/stopDiscover`, null, { headers, timeout: 5000 });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Start Z-Wave Inclusion
    async startZwaveInclusion() {
        if (!this.ip) throw new Error('Hubitat IP not configured');
        try {
            await this.login();
            const headers = this.sessionCookie ? { Cookie: this.sessionCookie } : {};
            const res = await axios.get(`http://${this.ip}/hub/zwave/include`, { headers, timeout: 5000 });
            return { success: true, mode: 'zwave_include', data: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Start Z-Wave Exclusion (Unpairing)
    async startZwaveExclusion() {
        if (!this.ip) throw new Error('Hubitat IP not configured');
        try {
            await this.login();
            const headers = this.sessionCookie ? { Cookie: this.sessionCookie } : {};
            const res = await axios.get(`http://${this.ip}/hub/zwave/exclude`, { headers, timeout: 5000 });
            return { success: true, mode: 'zwave_exclude', data: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Save Groovy Driver to Hubitat Hub
    async pushDriverToHub(driverCode, driverId = null, driverName = 'Custom Driver') {
        if (!this.ip) throw new Error('Hubitat IP not configured');
        try {
            await this.login();
            const headers = this.sessionCookie ? { Cookie: this.sessionCookie } : {};
            headers['Content-Type'] = 'application/x-www-form-urlencoded';

            const params = new URLSearchParams();
            if (driverId) params.append('id', driverId);
            params.append('source', driverCode);
            params.append('version', '1');

            const res = await axios.post(`http://${this.ip}/driver/save`, params, {
                headers,
                timeout: 10000
            });
            return { success: true, data: res.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Static code validation & linting for Groovy drivers
    static validateGroovyDriver(code) {
        const warnings = [];
        const errors = [];

        if (!code || typeof code !== 'string' || !code.trim()) {
            return { valid: false, errors: ['Driver source code cannot be empty'], warnings: [] };
        }

        // Bracket & Parenthesis matching check
        let openBraces = 0;
        let openParens = 0;
        for (let i = 0; i < code.length; i++) {
            if (code[i] === '{') openBraces++;
            if (code[i] === '}') openBraces--;
            if (code[i] === '(') openParens++;
            if (code[i] === ')') openParens--;
            if (openBraces < 0) {
                errors.push(`Mismatched closing brace '}' around character ${i}`);
                break;
            }
            if (openParens < 0) {
                errors.push(`Mismatched closing parenthesis ')' around character ${i}`);
                break;
            }
        }
        if (openBraces > 0) errors.push(`Unclosed opening brace '{' (missing ${openBraces} closing braces)`);
        if (openParens > 0) errors.push(`Unclosed opening parenthesis '(' (missing ${openParens} closing parentheses)`);

        // Hubitat Driver structural blocks
        const hasMetadata = /metadata\s*\{/.test(code);
        const hasDefinition = /definition\s*\(/.test(code);
        const hasCapabilities = /capability\s+["']/.test(code);

        if (!hasMetadata && !hasDefinition) {
            warnings.push("Missing 'metadata { definition(...) }' block required for Hubitat drivers.");
        }
        if (!hasCapabilities) {
            warnings.push("No standard capabilities declared (e.g. capability 'Switch', capability 'Refresh').");
        }

        // Check for SmartThings-only unsupported imports
        if (/physicalgraph\./.test(code)) {
            warnings.push("Contains 'physicalgraph' references. Replace with standard Hubitat namespaces (e.g. hubitat.zigbee or hubitat.zwave).");
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    static async validateConnection(config) {
        if (!config.ip || !config.appId || !config.token) {
            return { success: false, error: 'IP, App ID, and Access Token are required' };
        }
        const testUrl = `http://${config.ip}/apps/api/${config.appId}/devices`;
        try {
            const res = await axios.get(testUrl, {
                params: { access_token: config.token },
                timeout: 6000
            });
            const deviceCount = Array.isArray(res.data) ? res.data.length : 0;
            return { success: true, deviceCount };
        } catch (error) {
            let msg = error.message;
            if (error.response?.status === 401) {
                msg = 'Invalid Maker API Access Token (401 Unauthorized)';
            } else if (error.response?.status === 404) {
                msg = `Maker API App ID ${config.appId} not found on hub (404 Not Found)`;
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                msg = `Could not reach Hubitat at ${config.ip} (Connection timed out / refused)`;
            }
            return {
                success: false,
                error: msg
            };
        }
    }
}

module.exports = HubitatClient;

