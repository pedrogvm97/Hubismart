const axios = require('axios');

class HubitatClient {
    constructor(config) {
        this.baseUrl = `http://${config.ip}/apps/api/${config.appId}`;
        this.accessToken = config.accessToken;
    }

    async getDevices() {
        try {
            const response = await axios.get(`${this.baseUrl}/devices`, {
                params: { access_token: this.accessToken }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching devices:', error.message);
            throw error;
        }
    }

    async getDeviceDetails(deviceId) {
        try {
            const response = await axios.get(`${this.baseUrl}/devices/${deviceId}`, {
                params: { access_token: this.accessToken }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching details for device ${deviceId}:`, error.message);
            throw error;
        }
    }

    async sendCommand(deviceId, command, secondary = '') {
        try {
            const url = `${this.baseUrl}/devices/${deviceId}/${command}${secondary ? `/${secondary}` : ''}`;
            const response = await axios.get(url, {
                params: { access_token: this.accessToken }
            });
            return response.data;
        } catch (error) {
            console.error(`Error sending command ${command} to device ${deviceId}:`, error.message);
            throw error;
        }
    }

    static async validateConnection(config) {
        const testUrl = `http://${config.ip}/apps/api/${config.appId}/devices`;
        try {
            await axios.get(testUrl, {
                params: { access_token: config.token },
                timeout: 5000
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.status === 401 ? 'Invalid Access Token' : error.message
            };
        }
    }
}

module.exports = HubitatClient;
