// test-gcs.js
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;

async function testGCSConnection() {
  try {
    const [buckets] = await storage.getBuckets();
    console.log('Successfully connected to Google Cloud Storage');
    console.log('Available buckets:', buckets.map(bucket => bucket.name));

    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles();
    console.log(`Files in bucket ${bucketName}:`, files.map(file => file.name));

    // Test file upload
    const testFileName = 'test-file.txt';
    const file = bucket.file(testFileName);
    await file.save('This is a test file');
    console.log(`Test file "${testFileName}" uploaded successfully`);

    // Test file download
    const [fileContent] = await file.download();
    console.log('Downloaded file content:', fileContent.toString());

    // Clean up: delete the test file
    await file.delete();
    console.log(`Test file "${testFileName}" deleted successfully`);

  } catch (error) {
    console.error('Error testing GCS connection:', error);
  }
}

testGCSConnection();

// If all tests pass, update your storageController.js
// Here's a revised version of uploadFile function as an example:

exports.uploadFile = async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.save(Buffer.from(fileContent, 'base64'));
    res.status(200).send(`File ${fileName} uploaded successfully`);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send(`Error uploading file: ${error.message}`);
  }
};