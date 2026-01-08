// Em products.js

const meusProdutos = [
    {
        id: '687ea04cfcc65d99d7010c5e',
        nome: 'Combo Casal - 2 Burgões + Batata Especial 250g',
        preco: 32.90,
        precoOriginal: 53.80,
        imagem: 'https://i.ibb.co/mV8pzYWk/1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c61',
        nome: '4 Burgões da Casa + 2 porções de batata com cheddar e bacon 500g + refrigerante 2L',
        preco: 49.90,
        precoOriginal: 75.80,
        imagem: 'https://i.ibb.co/1tMyFvkX/2-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c64',
        nome: 'Burgão, Batata Frita 250g e Refrigerante 350ml',
        preco: 19.90,
        precoOriginal: 39.90,
        imagem: 'https://i.ibb.co/Kxhk2XHD/3-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c67',
        nome: 'Burgão Especial',
        preco: 15.90,
        precoOriginal: 39.90,
        imagem: 'https://i.ibb.co/p6QPjf17/4-2.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c6a',
        nome: 'Burgão Duplo',
        preco: 16.90,
        precoOriginal: 41.90,
        imagem: 'https://i.ibb.co/XrcfC9fy/5-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c6d',
        nome: 'Burgão Triplo',
        preco: 27.90,
        precoOriginal: 45.90,
        imagem: 'https://i.ibb.co/Dg6NpFPR/6-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c70',
        nome: 'X-Tudo Supremo',
        preco: 17.00,
        precoOriginal: 19.00,
        imagem: 'https://i.ibb.co/1GBTwknT/7-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c73',
        nome: 'Burgão Caramelizado',
        preco: 20.00,
        precoOriginal: 27.00,
        imagem: 'https://i.ibb.co/S4P93zrv/8-1.webp'
    },
    {
        id: '687ea04cfcc65d99d7010c76',
        nome: 'Burguer cheddar e bacon',
        preco: 19.00,
        precoOriginal: 26.00,
        imagem: 'https://i.ibb.co/p6kBMzcz/9.webp'
    },
    // === ACOMPANHAMENTOS ===
    {
        id: 'feijoada-500g',
        nome: 'Feijoada - 500g',
        preco: 19.90,
        precoOriginal: 19.90,
        imagem: 'https://i.ibb.co/1tm4grft/6735b0ac-DSC04873.jpg'
    },
    {
        id: 'nhoque-mandioca-500g',
        nome: 'Nhoque De Mandioca - 500g',
        preco: 16.90,
        precoOriginal: 16.90,
        imagem: 'https://i.ibb.co/TDrrvTLs/6c7df818-DSC04861.jpg'
    },
    {
        id: 'arroz-branco-300g',
        nome: 'Arroz Branco | 300g',
        preco: 9.90,
        precoOriginal: 9.90,
        imagem: 'https://i.ibb.co/v6PHB70k/30c4614f-DSC04585.jpg'
    },
    {
        id: 'feijao-tropeiro-300g',
        nome: 'Feijão tropeiro - 300g',
        preco: 12.90,
        precoOriginal: 12.90,
        imagem: 'https://i.ibb.co/MkQCDnSN/2380dacc-DSC04610.jpg'
    },
    {
        id: 'mandioca-cozida-300g',
        nome: 'Mandioca Cozida | 300g',
        preco: 8.90,
        precoOriginal: 8.90,
        imagem: 'https://i.ibb.co/MyZRHkB2/a2b4b8fb-DSC04563.jpg'
    },
    {
        id: 'pacoca-pilao-220g',
        nome: 'Paçoca de Pilão - 220g',
        preco: 9.90,
        precoOriginal: 9.90,
        imagem: 'https://i.ibb.co/RTbW01tn/e5c77b10-DSC06101.jpg'
    },
    {
        id: 'torresmo-100g',
        nome: 'Torresmo | 100g',
        preco: 6.90,
        precoOriginal: 6.90,
        imagem: 'https://i.ibb.co/d8FGRkW/202012311023-9-XVv.jpg'
    },
    {
        id: 'farofa-cebola-200g',
        nome: 'Farofa de Cebola - 200g',
        preco: 6.90,
        precoOriginal: 6.90,
        imagem: 'https://i.ibb.co/Gf7NwY4j/202105241130-278-Q.jpg'
    },
    // === SALADAS ===
    {
        id: 'vinagrete-300g',
        nome: 'Vinagrete | 300g',
        preco: 11.90,
        precoOriginal: 11.90,
        imagem: 'https://i.ibb.co/S4Z3QLzr/d4686221-DSC06204.jpg'
    },
    {
        id: 'maionese-legumes-300g',
        nome: 'Maionese de Legumes | 300g',
        preco: 12.90,
        precoOriginal: 12.90,
        imagem: 'https://i.ibb.co/1JGncRst/644d0d24-DSC04746.jpg'
    },
    {
        id: 'salpicao-300g',
        nome: 'Salpicão | 300g',
        preco: 10.90,
        precoOriginal: 10.90,
        imagem: 'https://i.ibb.co/Df4Ysg1c/bef05fa1-DSC04702.jpg'
    },
    {
        id: 'legumes-cozidos-300g',
        nome: 'Legumes cozidos misto | 300g',
        preco: 11.90,
        precoOriginal: 11.90,
        imagem: 'https://i.ibb.co/gZp2352z/78870749-DSC04675.jpg'
    }
];

/**
 * Função para encontrar produto por ID.
 * Esta função deve estar disponível globalmente para o script do carrinho poder usá-la.
 * @param {string} id - O ID do produto a ser encontrado.
 * @returns {object | undefined} O objeto do produto se encontrado, ou undefined.
 */
function encontrarProdutoPorId(id) {
    if (typeof meusProdutos === 'undefined') {
        console.error("A lista 'meusProdutos' não está definida.");
        return null;
    }
    return meusProdutos.find(produto => produto.id === id);
}