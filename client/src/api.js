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

export const recordingsApi = {
    getRecordings: async (params = {}) => {
        const response = await axios.get(`${API_BASE}/recordings`, { params });
        return response.data;
    },
    getRecording: async (id) => {
        const response = await axios.get(`${API_BASE}/recordings/${id}`);
        return response.data;
    },
    getVideoUrl: (id) => {
        return `${API_BASE}/recordings/${id}/video`;
    },
    getThumbnailUrl: (id) => {
        return `${API_BASE}/recordings/${id}/thumbnail`;
    },
    toggleLock: async (id) => {
        const response = await axios.post(`${API_BASE}/recordings/${id}/lock`);
        return response.data;
    },
    tagRecording: async (id, data) => {
        const response = await axios.post(`${API_BASE}/recordings/${id}/tag`, data);
        return response.data;
    },
    deleteRecording: async (id) => {
        const response = await axios.delete(`${API_BASE}/recordings/${id}`);
        return response.data;
    },
    getPersons: async () => {
        const response = await axios.get(`${API_BASE}/persons`);
        return response.data;
    },
    addPerson: async (data) => {
        const response = await axios.post(`${API_BASE}/persons`, data);
        return response.data;
    }
};

export const storageApi = {
    getStatus: async () => {
        const response = await axios.get(`${API_BASE}/storage/status`);
        return response.data;
    },
    updateSettings: async (settings) => {
        const response = await axios.post(`${API_BASE}/storage/settings`, settings);
        return response.data;
    }
};

export const systemApi = {
    getVersionStatus: async () => {
        const response = await axios.get(`${API_BASE}/system/version`);
        return response.data;
    },
    checkForUpdates: async () => {
        const response = await axios.post(`${API_BASE}/system/check-updates`);
        return response.data;
    },
    applyUpdate: async (targetTag) => {
        const response = await axios.post(`${API_BASE}/system/update`, { targetTag });
        return response.data;
    },
    getSettings: async () => {
        const response = await axios.get(`${API_BASE}/system/settings`);
        return response.data;
    },
    updateSettings: async (settings) => {
        const response = await axios.post(`${API_BASE}/system/settings`, settings);
        return response.data;
    }
};


