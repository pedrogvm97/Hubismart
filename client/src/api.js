import axios from 'axios';

const API_BASE = '/api';

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

export const cameraApi = {
    getCameras: async () => {
        const response = await axios.get(`${API_BASE}/cameras`);
        return response.data;
    },
    scanCameras: async () => {
        const response = await axios.post(`${API_BASE}/cameras/scan`);
        return response.data;
    },
    createCamera: async (data) => {
        const response = await axios.post(`${API_BASE}/cameras`, data);
        return response.data;
    },
    updateCamera: async (id, data) => {
        const response = await axios.put(`${API_BASE}/cameras/${id}`, data);
        return response.data;
    },
    deleteCamera: async (id) => {
        const response = await axios.delete(`${API_BASE}/cameras/${id}`);
        return response.data;
    },
    testConnection: async (id, verificationCode = null) => {
        const response = await axios.post(`${API_BASE}/cameras/${id}/test`, {
            verification_code: verificationCode
        });
        return response.data;
    },
    getDebugLogs: async () => {
        const response = await axios.get(`${API_BASE}/cameras/debug/logs`);
        return response.data;
    },
    getStreamUrl: (id, token = '') => {
        return `${API_BASE}/cameras/${id}/stream${token ? `?t=${token}` : ''}`;
    },
    getSnapshotUrl: (id, token = '') => {
        return `${API_BASE}/cameras/${id}/snapshot${token ? `?t=${token}` : ''}`;
    }
};
