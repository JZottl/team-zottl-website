// Netlify Function: creates a Stripe Checkout Session.
// This runs on Netlify's servers, NOT in the browser — so your
// Stripe SECRET key stays private and is never exposed to visitors.
//
// SETUP REQUIRED (one-time):
// 1. In your Netlify dashboard, go to: Site configuration > Environment variables
// 2. Add a new variable:
//      Key:   STRIPE_SECRET_KEY
//      Value: your Stripe secret key (starts with sk_test_... or sk_live_...)
//             Find it in Stripe Dashboard > Developers > API keys
// 3. Redeploy your site after adding the variable (Netlify usually prompts you to).
//
// This function expects a POST request with JSON body: { "priceId": "price_..." }
// It looks up whether that price is recurring or one-time automatically,
// so you don't need to maintain a separate list here.

const Stripe = require('stripe');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in Netlify environment variables.'
      })
    };
  }

  const stripe = Stripe(secretKey);

  try {
    const { priceId } = JSON.parse(event.body || '{}');

    if (!priceId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing priceId' }) };
    }

    // Look up the price in Stripe to determine if it's recurring or one-time.
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === 'recurring' ? 'subscription' : 'payment';

    // Figure out the site URL for success/cancel redirects.
    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
