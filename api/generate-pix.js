const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. Configuração de CORS e Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Validação das Chaves
  const publicKey = process.env.ANUBIS_PUBLIC_KEY;
  const secretKey = process.env.ANUBIS_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return res.status(500).json({ error: 'Configuração de servidor incompleta (Chaves).' });
  }

  try {
    const { amount, customer } = req.body;

    // 3. Tratamento de Valor
    let valueInCents = 0;
    if (typeof amount === 'string') {
      valueInCents = Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100);
    } else {
      valueInCents = Math.round(amount * 100);
    }

    // 4. Tratamento do Telefone (DDI 55 Obrigatório)
    let rawPhone = (customer?.phone || "").replace(/\D/g, '');
    if (rawPhone.length < 10) rawPhone = "11999999999"; 
    // Garante o 55 do Brasil
    if (!rawPhone.startsWith('55')) {
        rawPhone = '55' + rawPhone;
    }

    // 5. Tratamento do CPF (Usa o CPF que você validou se o do cliente falhar)
    let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
    const cpfsInvalidos = ["12345678909", "11111111111", "00000000000", ""];
    
    if (!rawCpf || rawCpf.length !== 11 || cpfsInvalidos.includes(rawCpf)) {
         rawCpf = "97834989910"; // SEU CPF VÁLIDO
    }

    // E-mail único para evitar bloqueio de duplicidade
    const uniqueId = Math.floor(Date.now() / 1000);
    const email = customer?.email && customer.email.includes('@') 
        ? customer.email 
        : `cliente.${uniqueId}@gmail.com`;

    // 6. PAYLOAD EM PASCALCASE (Letras Maiúsculas)
    // Isso resolve o erro "Phone field is required" em APIs .NET
    const payload = {
      Amount: valueInCents,
      PaymentMethod: "pix",
      PostbackUrl: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      Customer: {
        Name: customer?.name || 'Cliente Consumidor',
        Email: email,
        Phone: rawPhone, // PascalCase: Phone
        Document: {
          Type: "cpf",   // Alguns gateways aceitam Type minusculo, mas keys maiusculas
          Number: rawCpf
        }
      },
      Items: [
        {
          Title: 'Pedido Cheff Burguer',
          UnitPrice: valueInCents,
          Quantity: 1,
          Tangible: false
        }
      ],
      Metadata: {
        ProviderName: "Checkout Próprio"
      },
      Pix: {
        ExpiresIn: 3600
      }
    };

    console.log("Enviando Payload:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // 7. URL SINGULAR (A ÚNICA QUE FUNCIONA)
    const apiResponse = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await apiResponse.text();

    // Verificação de Erro HTML (Gateway fora do ar ou URL errada)
    if (text.trim().startsWith('<')) {
        console.error("ERRO CRÍTICO (HTML):", text);
        return res.status(502).json({ error: 'Erro de comunicação com o Gateway (Retornou HTML).' });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("ERRO JSON:", text);
      return res.status(500).json({ error: 'Resposta inválida da API.' });
    }

    if (apiResponse.ok) {
      // Sucesso! Tenta pegar o Pix de campos PascalCase ou snake_case
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
      console.error("ERRO API ANUBIS:", JSON.stringify(data));
      
      // Formata a mensagem de erro para exibir no frontend
      let msg = "Falha no pagamento.";
      if (data.errors) {
          // Pega o primeiro erro da lista (ex: Customer.Phone is required)
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
    return res.status(500).json({ error: 'Erro interno no servidor Vercel.' });
  }
};