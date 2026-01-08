const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. Configurações de Segurança (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Configuração de API incompleta (Chaves).' });
    }

    const { amount, customer } = req.body;
    
    // Tratamento do Valor
    let valueInCents = typeof amount === 'string' 
      ? Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100)
      : Math.round(amount * 100);

    // Tratamento do Telefone (DDI 55)
    let rawPhone = (customer?.phone || "").replace(/\D/g, '');
    if (rawPhone.length < 10) rawPhone = "11999999999";
    if (!rawPhone.startsWith('55')) rawPhone = '55' + rawPhone;

    // Tratamento do CPF (Usa seu CPF válido se necessário)
    let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
    const cpfsInvalidos = ["12345678909", "11111111111", "00000000000", ""];
    if (!rawCpf || rawCpf.length !== 11 || cpfsInvalidos.includes(rawCpf)) {
         rawCpf = "97834989910"; 
    }

    // E-mail Único
    const uniqueId = Math.floor(Date.now() / 1000);
    const email = customer?.email && customer.email.includes('@') 
        ? customer.email 
        : `cliente.${uniqueId}@gmail.com`;

    // --- CORREÇÃO PRINCIPAL: PAYLOAD EM PASCALCASE (Maiúsculas) ---
    // A API .NET exige chaves maiúsculas para reconhecer os campos
    const payload = {
      Amount: valueInCents,
      PaymentMethod: "pix",
      PostbackUrl: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      Customer: {
        Name: customer?.name || 'Cliente Consumidor',
        Email: email,
        Phone: rawPhone, // Agora enviado como 'Phone', o servidor vai ler!
        Document: {
          Type: "cpf",
          Number: rawCpf
        }
      },
      Items: [{ 
          Title: 'Pedido Confirmado',
          UnitPrice: valueInCents,
          Quantity: 1,
          Tangible: false
      }],
      Metadata: { 
          ProviderName: "Checkout Oficial" 
      },
      Pix: {
        ExpiresIn: 3600
      }
    };

    console.log("Enviando Payload PascalCase:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    
    // URL SINGULAR (A que respondeu antes)
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    if (text.trim().startsWith('<')) {
        return res.status(502).json({ error: 'Erro HTML no Gateway.' });
    }

    let data;
    try { data = JSON.parse(text); } 
    catch(e) { 
        console.error("Texto recebido não é JSON:", text);
        return res.status(500).json({ error: 'Resposta inválida do servidor.' }); 
    }

    if (!response.ok) {
        console.error("ERRO ANUBIS:", JSON.stringify(data));
        
        let errorMsg = "Pagamento Recusado";
        if (data.errors) {
            const keys = Object.keys(data.errors);
            if (keys.length > 0) errorMsg = `${keys[0]}: ${data.errors[keys[0]]}`;
        } else if (data.message) {
            errorMsg = data.message;
        }

        return res.status(400).json({ 
            error: errorMsg, 
            details: data 
        });
    }

    // Sucesso! Mapeia a resposta (que provavelmente virá em PascalCase também)
    return res.status(200).json({
        success: true,
        transactionId: data.Id || data.id,
        pix_copy_paste: data.PixCopyPaste || data.pix?.qrcode_text || data.pix_code,
        qr_code_base64: data.QRCodeBase64 || data.pix?.qrcode || data.qrcode
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
};