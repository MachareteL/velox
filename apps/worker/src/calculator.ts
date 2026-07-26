/**
  Calcula o valor da prévia com base na distância da base de origem
  @param distanciaInput Distância informada no formulário (string ou number)
  @returns Valor numérico da prévia (ex: 90, 120 ou 150)
 */
export function calcularPrevia(distanciaInput: string | number | undefined | null): number {
  if (distanciaInput === undefined || distanciaInput === null) {
    return 50;
  }

  const distancia = typeof distanciaInput === 'number' 
    ? distanciaInput 
    : parseInt(distanciaInput.replace(/\D/g, ''), 10) || 0;

  if (distancia <= 85) return 50;
  if (distancia <= 170) return 120;
  return 150;
}
