/**
 * Converte o valor de distância recebido do formulário Velox para QUILÔMETROS.
 * No Velox, o valor numérico bruto (ex: "1002") representa 10.02 km (~10 km) — divisão por 100.
 * Ex: "1002" -> 10.02 (km)
 * Ex: 8500 -> 85 (km)
 * @param distanciaInput Distância recebida do formulário Velox (string ou number)
 * @returns Distância em quilômetros (number)
 */
export function converterMetrosParaKm(distanciaInput: string | number | undefined | null): number {
  if (distanciaInput === undefined || distanciaInput === null) {
    return 0;
  }

  let val = 0;
  if (typeof distanciaInput === 'number') {
    val = distanciaInput;
  } else {
    const cleaned = String(distanciaInput).replace(/\D/g, '');
    val = parseInt(cleaned, 10) || 0;
  }

  const km = val / 100;
  return Math.round(km * 100) / 100;
}

/**
 * Retorna aleatoriamente um dos elementos do array fornecido.
 */
function sortearOpcao<T>(opcoes: T[]): T {
  const index = Math.floor(Math.random() * opcoes.length);
  return opcoes[index];
}

/**
 * Calcula o valor da prévia em minutos com base na distância em QUILÔMETROS.
 * Aleatoriza a prévia escolhendo entre 3 opções (com passo de 5 min até o limite máximo da faixa):
 * - Distância <= 85 km:  50, 45 ou 40 minutos
 * - Distância <= 170 km: 120, 115 ou 110 minutos
 * - Distância > 170 km:  150, 145 ou 140 minutos
 * @param distanciaKm Distância em quilômetros
 * @returns Valor numérico da prévia em minutos
 */
export function calcularPreviaKm(distanciaKm: number): number {
  if (distanciaKm <= 85) {
    return sortearOpcao([50, 45, 40]);
  }
  if (distanciaKm <= 170) {
    return sortearOpcao([120, 115, 110]);
  }
  return sortearOpcao([150, 145, 140]);
}

/**
 * Calcula o valor da prévia em minutos a partir de uma distância em METROS.
 * Centraliza a conversão e o cálculo em uma única chamada.
 * @param distanciaMetrosInput Distância em metros informada no formulário (string ou number)
 * @returns Valor numérico da prévia (ex: 50, 120 ou 150)
 */
export function calcularPrevia(distanciaMetrosInput: string | number | undefined | null): number {
  const distanciaKm = converterMetrosParaKm(distanciaMetrosInput);
  return calcularPreviaKm(distanciaKm);
}
