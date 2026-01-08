const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Erro de configuração (Chaves).' });
    }

    const { amount, customer } = req.body;
    
    // Tratamento de Valor
    let valueInCents = typeof amount === 'string' 
      ? Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100)
      : Math.round(amount * 100);

    // --- CORREÇÃO DO TELEFONE (FORÇADA) ---
    // Se o cliente não mandar telefone, usa o meu padrão.
    // A AnubisPay EXIGE esse campo preenchido.
    let finalPhone = "11999999999"; 
    
    if (customer && customer.phone) {
        // Limpa e deixa só números
        const clean = customer.phone.replace(/\D/g, '');
        if (clean.length >= 10) finalPhone = clean;
    }

    const payload = {
      amount: valueInCents,
      payment_method: 'pix',
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      customer: {
        name: customer?.name || 'Cliente Visitante',
        email: customer?.email || 'cliente@email.com',
        phone: finalPhone, // Aqui vai o telefone garantido
        document: {
          type: 'cpf',
          number: customer?.cpf?.replace(/\D/g, '') || '12345678909'
        }
      },
      items: [{ 
          title: 'Pedido Online',
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
      }],
      metadata: { provider: "Vercel Checkout" }
    };

    // Log para você conferir no painel da Vercel > Logs
    console.log("PAYLOAD ENVIADO PARA ANUBIS:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    // Verificação de Erro HTML
    if (text.trim().startsWith('<')) {
        console.error("ERRO HTML ANUBIS:", text);
        return res.status(502).json({ error: 'Erro na API Anubis (HTML retornado).' });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) { 
        return res.status(500).json({ error: 'Resposta inválida.' }); 
    }

    if (!response.ok) {
        console.error("ERRO ANUBIS JSON:", data);
        return res.status(response.status).json({ 
            error: 'Erro na AnubisPay', 
            details: data // Isso vai mostrar o erro exato na sua tela
        });
    }

    // Sucesso
    return res.status(200).json({
        success: true,
        transactionId: data.Id || data.id,
        pix_copy_paste: data.pix?.qrcode_text || data.qrcode_text || data.pix_code,
        qr_code_base64: data.pix?.qrcode || data.qrcode
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};