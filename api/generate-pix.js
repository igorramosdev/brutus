const fetch = require('node-fetch');

// Função para validar CPF (algoritmo oficial)
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    
    // Elimina CPFs inválidos conhecidos
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Valida 1º dígito
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto > 9 ? 0 : resto;
    
    // Valida 2º dígito
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto > 9 ? 0 : resto;
    
    return (parseInt(cpf.charAt(9)) === digito1 && 
            parseInt(cpf.charAt(10)) === digito2);
}

module.exports = async (req, res) => {
    // Configuração CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const publicKey = process.env.ANUBIS_PUBLIC_KEY;
        const secretKey = process.env.ANUBIS_SECRET_KEY;
        const webhookUrl = process.env.WEBHOOK_URL;

        if (!publicKey || !secretKey) {
            console.error('Chaves de API não configuradas');
            return res.status(500).json({ 
                error: 'Configuração do sistema incompleta' 
            });
        }

        const { amount, customer, orderId } = req.body;

        // Validação do valor
        if (!amount || isNaN(parseFloat(amount))) {
            return res.status(400).json({ 
                error: 'Valor inválido. Informe um número válido.' 
            });
        }
        
        let valueInCents = Math.round(parseFloat(amount) * 100);
        if (valueInCents < 100) {
            return res.status(400).json({ 
                error: 'Valor mínimo é R$ 1,00' 
            });
        }

        // Validação do telefone
        let rawPhone = (customer?.phone || "").replace(/\D/g, '');
        if (rawPhone.startsWith('55')) {
            rawPhone = rawPhone.substring(2);
        }
        if (rawPhone.length < 10 || rawPhone.length > 11) {
            return res.status(400).json({ 
                error: 'Telefone inválido. Use DDD + número (ex: 11999999999)' 
            });
        }

        // Validação do CPF (OBRIGATÓRIA)
        let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
        if (!rawCpf || !validarCPF(rawCpf)) {
            return res.status(400).json({ 
                error: 'CPF inválido. Por favor, informe um CPF válido.' 
            });
        }

        // Validação do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        let email = customer?.email || "";
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'E-mail inválido. Informe um e-mail válido.' 
            });
        }

        // Payload da API AnubisPay
        const payload = {
            amount: valueInCents,
            payment_method: "pix",
            postback_url: webhookUrl,
            metadata: { 
                provider_name: "Cardápio Digital",
                order_id: orderId || `pedido_${Date.now()}`,
                customer_name: customer?.name || "Cliente"
            },
            customer: {
                name: customer?.name?.substring(0, 100) || "Cliente",
                email: email.substring(0, 100),
                phone: rawPhone,
                document: {
                    type: "cpf",
                    number: rawCpf
                }
            },
            items: [
                {
                    title: "Pedido Online",
                    unit_price: valueInCents,
                    quantity: 1,
                    tangible: false
                }
            ]
        };

        console.log("Gerando transação:", { 
            amount: valueInCents, 
            customer: customer?.name,
            orderId: payload.metadata.order_id 
        });

        const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

        // Tenta endpoints alternativos
        const endpoints = [
            'https://api2.anubispay.com.br/v1/payment-transaction/create',
            'https://api2.anubispay.com.br/v1/payment-transactions/create'
        ];

        let lastResponse = null;
        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    timeout: 30000
                });

                const text = await response.text();
                let data = null;
                
                try { 
                    data = JSON.parse(text); 
                } catch(e) { 
                    console.error("Resposta não-JSON:", text.substring(0, 200));
                    continue;
                }

                if (response.ok) {
                    // Extrai dados do Pix
                    const pixCode = data.pix?.qrcode_text || data.qrcode_text || 
                                   data.pix_code || data.PixCopyPaste || data.copy_paste;
                    const qrImage = data.pix?.qrcode || data.qrcode || 
                                   data.qrcode_base64 || data.QRCodeBase64;
                    
                    if (!pixCode) {
                        console.error("API não retornou código Pix:", data);
                        continue;
                    }

                    console.log("Transação criada:", data.id || data.Id);
                    
                    return res.status(200).json({
                        success: true,
                        transactionId: data.id || data.Id,
                        pix_copy_paste: pixCode,
                        qr_code_base64: qrImage,
                        expires_in: 1800, // 30 minutos
                        payment_url: data.payment_url || null
                    });
                } else {
                    lastResponse = data;
                    lastError = response.status;
                }
            } catch (error) {
                console.error(`Erro no endpoint ${endpoint}:`, error.message);
                lastError = error.message;
            }
        }

        // Se todos os endpoints falharem
        console.error("Todos os endpoints falharam:", lastResponse);
        
        return res.status(400).json({
            error: lastResponse?.message || "Falha ao conectar com o gateway de pagamento",
            details: lastResponse || "Tente novamente em alguns instantes"
        });

    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};