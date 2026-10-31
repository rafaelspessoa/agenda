// Departamentos dos compradores (código -> nome). Um comprador pode ter vários.
export const DEPARTMENTS = {
  1: 'HIGIENE E BELEZA', 2: 'LIMPEZA', 3: 'MEDICAMENTOS', 4: 'HORTIFRUTI', 5: 'BOMBONIERE',
  6: 'BEBIDAS', 7: 'FOGOS', 8: 'PAPELARIA', 9: 'MERCEARIA DOCE', 10: 'LAZER',
  11: 'VETERINARIOS', 12: 'PETSHOP', 13: 'MERCEARIA SALGADA', 14: 'FRIOS', 15: 'PADARIA',
  16: 'BAZAR', 17: 'UTILIDADES', 19: 'ARMARINHO', 20: 'BRINQUEDOS E JOGOS', 21: 'FESTAS/DESCARTAVEIS',
  22: 'INFORMATICA E ELETRONICOS', 23: 'MATERIAL DE CONSTRUCAO', 24: 'AUTOMOTIVO', 25: 'JARDINAGEM', 26: 'LATICINIOS',
  27: 'CACA E PESCA', 28: 'COMMODITY', 29: 'ADEGA', 30: 'ALIMENTOS SAUDAVEIS', 31: 'PANIFICACAO'
};

// lista de códigos válidos, sem repetição e em ordem; null quando algum código não existe
export function cleanDepartments(value) {
  if (!Array.isArray(value)) return null;
  const codes = [...new Set(value.map(Number))].sort((a, b) => a - b);
  return codes.every(code => DEPARTMENTS[code]) ? codes : null;
}

export const ALL_DEPARTMENTS = Object.keys(DEPARTMENTS).map(Number);
