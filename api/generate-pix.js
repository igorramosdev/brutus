const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Erro de configuração.', details: 'Credenciais ausentes.' });
    }

    const { amount, customer, items } = req.body;

    let valueInCents = 0;
    if (typeof amount === 'string') {
      valueInCents = Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100);
    } else {
      valueInCents = Math.round(amount * 100);
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // --- CORREÇÃO AQUI: ADICIONADO O CAMPO PHONE ---
    const apiPayload = {
      amount: valueInCents,
      payment_method: 'pix',
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      customer: {
        name: customer?.name || 'Cliente Visitante',
        email: customer?.email || 'cliente@email.com',
        // A Anubis exige telefone. Se não vier, usamos um padrão válido.
        phone: customer?.phone?.replace(/\D/g, '') || '11999999999', 
        document: {
          type: 'cpf',
          number: customer?.cpf?.replace(/\D/g, '') || '12345678909' // CPF Padrão válido para teste
        }
      },
      items: items || [{ title: 'Pedido Online', unit_price: valueInCents, quantity: 1, tangible: false }],
      metadata: { provider_name: "Checkout Vercel" }
    };

    console.log("Payload enviado:", JSON.stringify(apiPayload));

    const apiResponse = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(apiPayload)
    });

    const responseText = await apiResponse.text();

    if (responseText.trim().startsWith('<')) {
      return res.status(502).json({ error: 'Erro na operadora.', details: 'API retornou HTML.' });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: 'Resposta inválida da API.' });
    }

    if (apiResponse.ok) {
      const pixCode = data.pix?.qrcode_text || data.qrcode_text || data.pix_code || data.PixCopyPaste;
      const qrImage = data.pix?.qrcode || data.qrcode || data.qrcode_base64;
      const transactionId = data.Id || data.id || data.transaction_id;

      return res.status(200).json({
        success: true,
        transactionId: transactionId,
        pix_copy_paste: pixCode,
        qr_code_base64: qrImage
      });
    } else {
      return res.status(apiResponse.status).json({
        error: data.message || 'Falha ao processar pagamento na AnubisPay.',
        details: data // Isso mostra o erro exato no frontend
      });
    }

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno: ' + error.message });
  }
};