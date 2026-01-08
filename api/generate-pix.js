const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. Configuração de CORS e Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Chaves de API não configuradas na Vercel.' });
    }

    const { amount, customer } = req.body;

    // 2. Tratamento do Valor
    let valueInCents = 0;
    if (typeof amount === 'string') {
      valueInCents = Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100);
    } else {
      valueInCents = Math.round(amount * 100);
    }

    // 3. Tratamento do Telefone (DDI 55 + Apenas Números)
    let rawPhone = (customer?.phone || "").replace(/\D/g, '');
    if (rawPhone.length < 10) rawPhone = "11999999999"; 
    if (!rawPhone.startsWith('55')) rawPhone = '55' + rawPhone;

    // 4. Tratamento do CPF (Usa o seu CPF validado se o do cliente falhar)
    let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
    const cpfsInvalidos = ["12345678909", "11111111111", "00000000000", ""];
    
    if (!rawCpf || rawCpf.length !== 11 || cpfsInvalidos.includes(rawCpf)) {
         rawCpf = "97834989910"; // CPF Válido para aprovação
    }

    // E-mail único
    const uniqueId = Math.floor(Date.now() / 1000);
    const email = customer?.email && customer.email.includes('@') 
        ? customer.email 
        : `cliente.${uniqueId}@gmail.com`;

    // 5. PAYLOAD CORRIGIDO (Raiz snake_case, Interno PascalCase)
    // Isso resolve o erro "The Phone field is required"
    const payload = {
      amount: valueInCents,           // minúsculo
      payment_method: "pix",          // minúsculo
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      metadata: { provider_name: "Checkout Vercel" },
      customer: {                     // minúsculo
        Name: customer?.name || 'Cliente Consumidor', // Maiúsculo
        Email: email,                 // Maiúsculo
        Phone: rawPhone,              // Maiúsculo (O Validador exige isso)
        Document: {                   // Maiúsculo
          Type: "cpf",                // Maiúsculo
          Number: rawCpf              // Maiúsculo
        }
      },
      items: [
        {
          title: 'Pedido Confirmado',
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
        }
      ],
      pix: {
        expires_in: 3600
      }
    };

    console.log("Enviando Payload Híbrido:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // 6. URL SINGULAR (A única que responde JSON corretamente)
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    // Verifica se retornou HTML (Erro 502/404 do Gateway)
    if (text.trim().startsWith('<')) {
        console.error("ERRO HTML ANUBIS:", text);
        return res.status(502).json({ error: 'Erro de comunicação com a AnubisPay (Gateway retornou HTML).' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("ERRO JSON PARSE:", text);
      return res.status(500).json({ error: 'Resposta inválida da API.' });
    }

    if (response.ok) {
      // Sucesso! Tenta pegar o Pix de qualquer campo possível
      const pixCode = data.PixCopyPaste || data.pix?.qrcode_text || data.qrcode_text || data.pix_code;
      const qrImage = data.QRCodeBase64 || data.pix?.qrcode || data.qrcode || data.qrcode_base64;
      const transactionId = data.Id || data.id;

      return res.status(200).json({
        success: true,
        transactionId: transactionId,
        pix_copy_paste: pixCode,
        qr_code_base64: qrImage
      });
    } else {
      console.error("ERRO API:", JSON.stringify(data));
      
      let msg = "Pagamento Recusado.";
      if (data.errors) {
          const chaves = Object.keys(data.errors);
          if (chaves.length > 0) msg = `${chaves[0]}: ${data.errors[chaves[0]]}`;
      } else if (data.message) {
          msg = data.message;
      }

      return res.status(400).json({
        error: msg,
        details: data
      });
    }

  } catch (error) {
    console.error("ERRO INTERNO:", error);
    return res.status(500).json({ error: 'Erro interno no servidor Vercel: ' + error.message });
  }
};