import axios from 'axios';

const API_BASE = 'http://localhost:3020/api';

export const hubApi = {
    getDevices: async () => {
        const response = await axios.get(`${API_BASE}/devices`);
        return response.data;
    },
    getDeviceDetails: async (id) => {
        const response = await axios.get(`${API_BASE}/devices/${id}`);
        return response.data;
    },
    sendCommand: async (id, command, secondary = '') => {
        const response = await axios.post(`${API_BASE}/devices/${id}/command`, { command, secondary });
        return response.data;
    }
};
