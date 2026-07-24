import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import type { AcceptPayload } from '@velox/types';
import { calcularPrevia } from './calculator';

export interface ScraperResult {
  success: boolean;
  durationMs: number;
  statusCode?: number;
  url: string;
  distanciaKm?: number;
  previaValor?: number;
  payload?: AcceptPayload;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  attemptsMade: number;
}

export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

export class VeloxScraper {
  private http: AxiosInstance;

  constructor(timeoutMs = 5000) {
    this.http = axios.create({
      timeout: timeoutMs,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  }

  /**
   * Processa a URL de convite do Velox realizando o GET e POST em ms com Retry Inteligente
   */
  public async processarConvite(url: string, maxAttempts = 2): Promise<ScraperResult> {
    const startTime = Date.now();
    let lastError: any = null;
    let attemptsMade = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsMade = attempt;

      try {
        if (attempt > 1) {
          console.log(`[Scraper] Tentativa ${attempt} de ${maxAttempts} para aceitar o convite: ${url}`);
        }

        // 1. GET na página do convite
        const responseGet = await this.http.get<string>(url);
        const $ = cheerio.load(responseGet.data);

        // 2. Verificação de convite já aceito por outro prestador (NÃO deve realizar retry)
        const textContent = $('body').text();
        if (textContent.includes('Convite já aceito por outro prestador')) {
          throw new NonRetryableError('Convite já aceito por outro prestador!');
        }

        // Extração dos campos ocultos do formulário
        let id = ($('#Id').val() as string) || '';
        let idAtendimentoConvite = ($('#IdAtendimentoConvite').val() as string) || '';
        let idAtendimentoAcionamento = ($('#IdAtendimentoAcionamento').val() as string) || '';
        let idAdesao = ($('#IdAdesao').val() as string) || '';
        let idCidadeAtendimento = ($('#IdCidadeAtendimento').val() as string) || '';
        let distanciaBaseOrigem = ($('#DistanciaBaseOrigem').val() as string) || '0';

        // Fallback: Tenta extrair a variável `const json = {...}` da tag <script> caso os inputs HTML estejam vazios
        if (!id || !idAtendimentoConvite) {
          $('script').each((_, element) => {
            const scriptText = $(element).html() || '';
            if (scriptText.includes('const json =')) {
              try {
                const match = scriptText.match(/const json = ({.*?});/s);
                if (match && match[1]) {
                  const parsedJson = JSON.parse(match[1]);
                  if (parsedJson.Id) id = String(parsedJson.Id);
                  if (parsedJson.IdAtendimentoConvite) idAtendimentoConvite = String(parsedJson.IdAtendimentoConvite);
                  if (parsedJson.IdAtendimentoAcionamento) idAtendimentoAcionamento = String(parsedJson.IdAtendimentoAcionamento);
                  if (parsedJson.IdAdesao) idAdesao = String(parsedJson.IdAdesao);
                  if (parsedJson.IdCidadeAtendimento) idCidadeAtendimento = String(parsedJson.IdCidadeAtendimento);
                  if (parsedJson.DistanciaBaseOrigem) distanciaBaseOrigem = String(parsedJson.DistanciaBaseOrigem);
                }
              } catch (jsonErr) {
                // Ignore JSON parse errors in script tag fallback
              }
            }
          });
        }

        if (!id || !idAtendimentoConvite) {
          if ($('.text-danger').length > 0) {
            const dangerMsg = $('.text-danger').text().trim();
            if (dangerMsg) throw new NonRetryableError(`Velox: ${dangerMsg}`);
          }
          throw new Error('Falha ao extrair ID do convite ou formulário Inválido (Convite pode ter sido encerrado).');
        }

        // Determinar URL de acionamento do formulário (resolvendo URL relativa)
        const actionAttr = $('#VisualizarConvite').attr('action');
        let actionUrl = url;
        if (actionAttr) {
          actionUrl = new URL(actionAttr, url).href;
        }

        // 3. Cálculo do valor da Prévia
        const distanciaNum = parseInt(distanciaBaseOrigem.replace(/\D/g, ''), 10) || 0;
        const valorPrevia = calcularPrevia(distanciaNum);

        // 4. Montagem do payload estritamente tipado
        const payload: AcceptPayload = {
          Id: id,
          IdAtendimentoConvite: idAtendimentoConvite,
          IdAtendimentoAcionamento: idAtendimentoAcionamento,
          Previa: { Previa: valorPrevia },
          Aceito: true,
          IdAdesao: idAdesao,
          IdCidadeAtendimento: idCidadeAtendimento,
        };

        // 5. POST de aceite imediato em milissegundos
        const responsePost = await this.http.post(actionUrl, payload);
        const durationMs = Date.now() - startTime;

        return {
          success: responsePost.status >= 200 && responsePost.status < 300,
          durationMs,
          statusCode: responsePost.status,
          url,
          distanciaKm: distanciaNum,
          previaValor: valorPrevia,
          payload,
          responsePayload: {
            status: responsePost.status,
            statusText: responsePost.statusText,
            data: responsePost.data,
          },
          attemptsMade,
        };
      } catch (error: any) {
        lastError = error;

        // Se o erro não for passível de retry (ex: convite já aceito por outro prestador), aborta imediatamente!
        if (error instanceof NonRetryableError || (error.message && error.message.includes('já aceito'))) {
          console.log(`[Scraper] Convite indisponível/já aceito. Encerrando sem retry: ${error.message}`);
          break;
        }

        // Se ainda houver tentativas restantes para erros temporários de rede/timeout, aguarda 300ms e tenta novamente
        if (attempt < maxAttempts) {
          console.warn(`[Scraper] Erro temporário no aceite (${error.message}). Re-tentando em 300ms...`);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      success: false,
      durationMs,
      url,
      errorMessage: lastError?.message || 'Erro desconhecido ao processar convite',
      attemptsMade,
    };
  }
}
