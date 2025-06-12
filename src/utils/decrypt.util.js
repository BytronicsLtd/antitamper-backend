const crypto = require('crypto');

function decryptSTM32Data(hexString) {
    const keyHex = process.env.AES_KEY;

    if (!keyHex) {
        throw new Error('AES_KEY not found in environment variables');
    }

    // Convert hex string to buffer
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 16) {
        throw new Error('AES key must be exactly 16 bytes (32 hex characters)');
    }

    console.log('Using AES key from environment');
    try {
        // Convert hex to buffer
        const encryptedBuffer = Buffer.from(hexString, 'hex');

        // Decrypt using AES-128-ECB (modern way)
        const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
        decipher.setAutoPadding(false);

        let decrypted = decipher.update(encryptedBuffer);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        // Remove PKCS7 padding
        const paddingLength = decrypted[decrypted.length - 1];
        const unpaddedBuffer = decrypted.slice(0, decrypted.length - paddingLength);

        // Convert to JSON
        const jsonString = unpaddedBuffer.toString('utf8');
        return JSON.parse(jsonString);

    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null;
    }
}
// // Test with your encrypted data
// const encryptedHex = "BDFA3218361818B8D02CE4A685A75D25F74E1E62F84B39088BA1FADC955ED25ACE2D49971D5C1889AC055B5205A2FF54ED49D76166B8A59C0A4748E58002433CE4446CF83051891B0513948AD20465AE79412B37CB9A30ACCF2E857B3EEF1773E8E29888F0FEC3EFADF31D63D3A2019FDA10AB709E1BF9045DCC90D2879803E2593F32C835B9E23914AD2A2CE6363878653062669AF83C238145A21FA04AA9E247BF463781ACEBFE75BF992EA825955A2FA90F7B1A9BBE26FEFC2AB255840BB50D3E9A838B1A5A7710A8FF08513E17DAA39A98AD0423C2666F9F64598AE0530F3DF16406A590C3866151F022AD0291D6C3FA5C8B7FEEFEB917580058E3BD88653E18CDD84FE7A3C90272021BBBD78B701244EA88BA9AA94F2941A166684D6D1C6B623F806AB3E4FD318AE9C073EDFE856D1C70247002BA3C97CB9B0F95D682876F36A5B82A930640F6F25F9A7F418C3394B4D507C1E9935BD80AAFA632FC47844A8D3614D397BC0B4CEFA26820A4D2656BD5518900CAFDAD5543C6C1979988BEAD0E855045841336372B9A0CECBCC2F41E453B8D93B2D627D1E2DF8CE18A2334282ECE77E40A8A11E283FE344BD7AAA1E628A18D7A6A5FA9F0102E4A8C3585E2BB131270835F3121320FB6693C4BACE95D2C47DB480FFCB4F1AE71730AA7D43C942C17A298441820EFF2D4C5C274E104F34813C0E398CFD2A5380CA26AEABC7E114B70BD7251D34B30EBF239F5B585B3C70681CA55E662895C5CBEBD3282EB6F";
// const decryptedJSON = decryptSTM32Data(encryptedHex);

// if (decryptedJSON) {
//     console.log('Decrypted JSON:');
//     console.log(JSON.stringify(decryptedJSON, null, 2));
// } else {
//     console.log('Decryption failed');
// }

// Export for use in other files
module.exports = { decryptSTM32Data };