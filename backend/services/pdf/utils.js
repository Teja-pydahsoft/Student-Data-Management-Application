const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// Logo URL
const LOGO_URL = 'https://static.wixstatic.com/media/bfee2e_7d499a9b2c40442e85bb0fa99e7d5d37~mv2.png/v1/fill/w_162,h_89,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo1.png';

/**
 * Download logo from URL and save to temporary file
 */
const downloadLogo = async () => {
  const tempDir = os.tmpdir();
  const logoPath = path.join(tempDir, `pydah_logo_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    const url = new URL(LOGO_URL);
    const client = url.protocol === 'https:' ? https : http;

    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download logo: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(logoPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(logoPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(logoPath, () => { }); // Delete file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

module.exports = {
    downloadLogo,
    LOGO_URL
};
