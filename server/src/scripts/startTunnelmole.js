import { tunnelmole } from 'tunnelmole';

async function main() {
  try {
    const url = await tunnelmole({
      port: 5000
    });
    console.log('\n======================================================');
    console.log('   PUBLIC TUNNEL IS LIVE                             ');
    console.log('======================================================');
    console.log(`Public Base URL  : ${url}`);
    console.log(`FULL WEBHOOK URL : ${url}/api/webhooks/razorpay`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Tunnelmole error:', err);
  }
}

main();
