import dotenv from 'dotenv';
import { razorpayInstance } from '../config/razorpay.js';

dotenv.config();

async function verifyRazorpaySetup() {
  const keyIdExists = Boolean(process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('your_'));
  const keySecretExists = Boolean(process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes('your_'));

  const credentialsDetected = keyIdExists && keySecretExists;
  const isTestMode = (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');

  let authStatus = 'FAILED';
  let errorMessage = null;

  if (credentialsDetected) {
    try {
      // Perform a harmless read-only GET request to verify authentication
      const testRes = await razorpayInstance.orders.all({ count: 1 });
      if (testRes && Array.isArray(testRes.items)) {
        authStatus = 'SUCCESS';
      } else {
        authStatus = 'SUCCESS';
      }
    } catch (err) {
      authStatus = 'FAILED';
      // Sanitize error message to avoid any credential reflection
      let rawErr = err.message || 'Unknown authentication error';
      if (process.env.RAZORPAY_KEY_SECRET) {
        rawErr = rawErr.replace(new RegExp(process.env.RAZORPAY_KEY_SECRET, 'g'), '[REDACTED]');
      }
      if (process.env.RAZORPAY_KEY_ID) {
        rawErr = rawErr.replace(new RegExp(process.env.RAZORPAY_KEY_ID, 'g'), '[REDACTED]');
      }
      errorMessage = rawErr;
    }
  } else {
    errorMessage = 'One or both Razorpay environment variables are missing from server/.env';
  }

  console.log('\n======================================================');
  console.log('   RAZORPAY TEST MODE CONFIGURATION VERIFICATION     ');
  console.log('======================================================');
  console.log(`- Credentials Detected: ${credentialsDetected ? 'YES' : 'NO'}`);
  console.log(`- Razorpay Authentication: ${authStatus}`);
  console.log(`- Test Mode: ${isTestMode ? 'YES' : 'NO'}`);
  if (errorMessage) {
    console.log(`- Error Message: ${errorMessage}`);
  }
  console.log('======================================================\n');
}

verifyRazorpaySetup();
