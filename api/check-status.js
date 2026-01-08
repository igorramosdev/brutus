const fetch = require('node-fetch');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const { id } = req.query;
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!id) {
        return res.status(400).json({ 
            error: 'ID da transação não informado' 
        });
    }

    if (!publicKey || !secretKey) {
        return res.status(500).json({ 
            error: 'Configuração do sistema incompleta' 
        });
    }

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // Lista de endpoints possíveis
    const endpoints = [
        `https://api2.anubispay.com.br/v1/payment-transactions/${id}`,
        `https://api2.anubispay.com.br/v1/payment-transaction/${id}`,
        `https://api2.anubispay.com.br/v1/transactions/${id}`
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'User-Agent': 'CardapioDigital/1.0'
                },
                timeout: 10000
            });

            if (response.ok) {
                const data = await response.json();
                
                // Normaliza o status
                const status = data.Status || data.status;
                const isPaid = status === 'PAID' || status === 'APPROVED';
                const isPending = status === 'PENDING' || status === 'WAITING_PAYMENT';
                const isExpired = status === 'EXPIRED';
                const isFailed = status === 'REFUSED' || status === 'ERROR' || 
                               status === 'REFUNDED' || status === 'CANCELLED';

                return res.status(200).json({
                    success: true,
                    paid: isPaid,
                    pending: isPending,
                    expired: isExpired,
                    failed: isFailed,
                    status: status,
                    status_raw: data,
                    paid_at: data.PaidAt || data.paid_at,
                    amount: data.Amount || data.amount
                });
            } else if (response.status === 404) {
                continue; // Tenta próximo endpoint
            }
        } catch (error) {
            console.error(`Erro no endpoint ${url}:`, error.message);
            continue;
        }
    }

    // Se nenhum endpoint funcionar
    return res.status(404).json({ 
        success: false,
        error: 'Transação não encontrada ou expirada',
        paid: false
    });
};