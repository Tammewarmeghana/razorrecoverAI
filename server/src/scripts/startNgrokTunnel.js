import ngrok from 'ngrok';

async function startTunnel() {
  try {
    const url = await ngrok.connect({
      proto: 'http',
      addr: 5000,
      authtoken: '3DJ9fhc7HlyTTA7GGXbMH4mfkKL_7kQD8nDN8RWanzXKrvFyi'
    });

    console.log('\n======================================================');
    console.log('   NGROK PUBLIC TUNNEL IS LIVE                        ');
    console.log('======================================================');
    console.log(`Public Base URL  : ${url}`);
    console.log(`FULL WEBHOOK URL : ${url}/api/webhooks/razorpay`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Failed to start ngrok tunnel:', err);
  }
}

startTunnel();
