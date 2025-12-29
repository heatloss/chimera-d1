const fs = require('fs');
const archiver = require('archiver');
const axios = require('axios');
const FormData = require('form-data');

const BUILD_DIR = './_site';
const ZIP_PATH = './site.zip';

async function deploy() {
  // 1. Zip the build folder
  const output = fs.createWriteStream(ZIP_PATH);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(BUILD_DIR, false);
    archive.finalize();
  });

  // 2. Upload to Shared Host
  const form = new FormData();
  form.append('secret', process.env.DEPLOY_SECRET);
  form.append('bundle', fs.createReadStream(ZIP_PATH));

  try {
    console.log(`Uploading to ${process.env.DEPLOY_URL}...`);
    const response = await axios.post(process.env.DEPLOY_URL, form, {
      headers: { ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log('Server Response:', response.data);
  } catch (error) {
    console.error('Deployment Failed:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

deploy();