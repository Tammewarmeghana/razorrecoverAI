import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_demo123456';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'demo_secret_key_123456';

export const isConfigured = Boolean(
  process.env.RAZORPAY_KEY_ID && 
  process.env.RAZORPAY_KEY_SECRET && 
  !process.env.RAZORPAY_KEY_ID.includes('your_')
);

// Instantiate Razorpay SDK instance securely
export const razorpayInstance = new Razorpay({
  key_id,
  key_secret
});

export const getRazorpayCredentials = () => ({
  key_id: isConfigured ? key_id : 'rzp_test_demo123456',
  isConfigured,
  mode: 'TEST'
});
