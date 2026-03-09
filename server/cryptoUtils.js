const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a configuration object using a password.
 * @param {Object} data - The config data to encrypt.
 * @param {string} password - The user's password.
 */
function encryptConfig(data, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
        v: 1,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        data: encrypted
    };
}

/**
 * Decrypts a configuration object using a password.
 * @param {Object} encryptedObj - The encrypted object from export.
 * @param {string} password - The user's password.
 */
function decryptConfig(encryptedObj, password) {
    try {
        const salt = Buffer.from(encryptedObj.salt, 'hex');
        const iv = Buffer.from(encryptedObj.iv, 'hex');
        const key = crypto.scryptSync(password, salt, 32);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (error) {
        throw new Error('Invalid password or corrupted backup file');
    }
}

module.exports = { encryptConfig, decryptConfig };
