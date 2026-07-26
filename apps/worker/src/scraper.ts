import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import type { AcceptPayload } from '@velox/types';
import { calcularPrevia } from './calculator';

export interface ScraperDebugInfo {
  failedStep?: 'HTTP_GET' | 'HTML_PARSING' | 'FORM_EXTRACTION' | 'HTTP_POST';
  getFinalUrl?: string;
  getStatusCode?: number;
  postStatusCode?: number;
  pageTitle?: string;
  bodyTextSnippet?: string;
  rawHtmlSnippet?: string;
  formAction?: string;
  allInputsFound?: Record<string, string>;
  scriptJsonFound?: Record<string, unknown> | null;
  errorStack?: string;
}

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
  debugInfo?: ScraperDebugInfo;
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
      maxRedirects: 5,
      validateStatus: () => true, // Permite capturar respostas como 302, 400, 404 sem estourar exceção imediatamente
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });
  }

  /**
   * Processa a URL de convite do Velox realizando o GET e POST em ms com Diagnóstico Detalhado
   */
  public async processarConvite(url: string, maxAttempts = 2): Promise<ScraperResult> {
    const startTime = Date.now();
    let lastError: any = null;
    let attemptsMade = 0;
    let debugInfo: ScraperDebugInfo = {};

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsMade = attempt;
      debugInfo = {};

      try {
        if (attempt > 1) {
          console.log(`[Scraper] Tentativa ${attempt} de ${maxAttempts} para aceitar o convite: ${url}`);
        }

        // -------------------------------------------------------------
        // ETAPA 1: GET na página de convite
        // -------------------------------------------------------------
        debugInfo.failedStep = 'HTTP_GET';
        const responseGet = await this.http.get<string>(url);
        
        debugInfo.getStatusCode = responseGet.status;
        debugInfo.getFinalUrl = responseGet.request?.res?.responseUrl || url;
        const htmlData = typeof responseGet.data === 'string' ? responseGet.data : String(responseGet.data || '');
        debugInfo.rawHtmlSnippet = htmlData.slice(0, 1500);

        if (responseGet.status < 200 || responseGet.status >= 300) {
          throw new Error(
            `HTTP GET retornou status ${responseGet.status} (${responseGet.statusText}) ao acessar ${url}`
          );
        }

        // -------------------------------------------------------------
        // ETAPA 2: PARSING HTML & DIAGNÓSTICO DO CORPO
        // -------------------------------------------------------------
        debugInfo.failedStep = 'HTML_PARSING';
        const $ = cheerio.load(htmlData);

        const pageTitle = $('title').text().trim() || 'Sem Título';
        debugInfo.pageTitle = pageTitle;

        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        debugInfo.bodyTextSnippet = bodyText.slice(0, 600);

        // Verificações de recusas conhecidas da Velox
        if (bodyText.includes('Convite já aceito por outro prestador')) {
          throw new NonRetryableError('Convite já aceito por outro prestador!');
        }
        if (bodyText.includes('Convite expirado') || bodyText.includes('Convite encerrado') || bodyText.includes('Convite cancelado')) {
          throw new NonRetryableError(`Convite indisponível no Velox (${pageTitle}): ${bodyText.slice(0, 150)}`);
        }
        if (bodyText.includes('Login') && (bodyText.includes('Senha') || bodyText.includes('Entrar'))) {
          throw new NonRetryableError(`Página de convite redirecionou para Login do Velox (Autenticação exigida). Título: ${pageTitle}`);
        }

        // -------------------------------------------------------------
        // ETAPA 3: EXTRAÇÃO MULTI-ESTRATÉGIA DE CAMPOS DO FORMULÁRIO
        // -------------------------------------------------------------
        debugInfo.failedStep = 'FORM_EXTRACTION';

        const allInputs: Record<string, string> = {};
        $('input').each((_, el) => {
          const key = $(el).attr('name') || $(el).attr('id');
          const val = $(el).val();
          if (key) {
            allInputs[key] = String(val ?? '');
          }
        });
        debugInfo.allInputsFound = allInputs;

        // Função auxiliar para busca insensível a maiúsculas/minúsculas
        const getValue = (candidateKeys: string[]): string => {
          for (const key of candidateKeys) {
            if (allInputs[key] !== undefined && allInputs[key] !== '') {
              return allInputs[key];
            }
            // Busca por chave case-insensitive
            const foundKey = Object.keys(allInputs).find(
              (k) => k.toLowerCase() === key.toLowerCase()
            );
            if (foundKey && allInputs[foundKey] !== undefined && allInputs[foundKey] !== '') {
              return allInputs[foundKey];
            }
          }
          return '';
        };

        let id = getValue(['Id', 'id']);
        let idAtendimentoConvite = getValue(['IdAtendimentoConvite', 'idAtendimentoConvite', 'id_atendimento_convite']);
        let idAtendimentoAcionamento = getValue(['IdAtendimentoAcionamento', 'idAtendimentoAcionamento']);
        let idAdesao = getValue(['IdAdesao', 'idAdesao']);
        let idCidadeAtendimento = getValue(['IdCidadeAtendimento', 'idCidadeAtendimento']);
        let distanciaBaseOrigem = getValue(['DistanciaBaseOrigem', 'distanciaBaseOrigem']) || '0';

        // Estratégia B: Extração via scripts JS (const json = {...})
        let scriptJson: Record<string, any> | null = null;
        $('script').each((_, element) => {
          const scriptText = $(element).html() || '';
          if (scriptText.includes('const json =') || scriptText.includes('var json =') || scriptText.includes('IdAtendimentoConvite')) {
            try {
              const match = scriptText.match(/(?:const|var|let)\s+json\s*=\s*({.*?});/s);
              if (match && match[1]) {
                const parsed = JSON.parse(match[1]);
                scriptJson = parsed;
                if (!id && parsed.Id) id = String(parsed.Id);
                if (!idAtendimentoConvite && parsed.IdAtendimentoConvite) idAtendimentoConvite = String(parsed.IdAtendimentoConvite);
                if (!idAtendimentoAcionamento && parsed.IdAtendimentoAcionamento) idAtendimentoAcionamento = String(parsed.IdAtendimentoAcionamento);
                if (!idAdesao && parsed.IdAdesao) idAdesao = String(parsed.IdAdesao);
                if (!idCidadeAtendimento && parsed.IdCidadeAtendimento) idCidadeAtendimento = String(parsed.IdCidadeAtendimento);
                if ((!distanciaBaseOrigem || distanciaBaseOrigem === '0') && parsed.DistanciaBaseOrigem) {
                  distanciaBaseOrigem = String(parsed.DistanciaBaseOrigem);
                }
              }
            } catch {
              // Ignore
            }
          }
        });
        debugInfo.scriptJsonFound = scriptJson;

        // Estratégia C: Extrair parâmetro ChaveConvite da URL do convite como fallback final
        let chaveConvite = '';
        try {
          const parsedUrl = new URL(url);
          chaveConvite = parsedUrl.searchParams.get('ChaveConvite') || '';
        } catch {
          // Ignore URL parse error
        }

        // Validação: Exige Id numérico ou ChaveConvite da URL
        if (!id && !chaveConvite) {
          if ($('.text-danger').length > 0) {
            const dangerMsg = $('.text-danger').text().trim();
            if (dangerMsg) throw new NonRetryableError(`Alerta Velox no HTML: "${dangerMsg}"`);
          }

          const keysFoundStr = Object.keys(allInputs).join(', ') || 'Nenhum input encontrado';
          throw new Error(
            `Falha na extração de ID/Chave do convite Velox! (Id: "${id}", Chave: "${chaveConvite}"). ` +
            `Título da Página: "${pageTitle}". Inputs encontrados: [${keysFoundStr}]. Snippet do corpo: "${bodyText.slice(0, 200)}"`
          );
        }

        // Determinar URL de ação do POST
        const actionAttr = $('#VisualizarConvite').attr('action') || $('form').attr('action');
        let actionUrl = url;
        if (actionAttr) {
          actionUrl = new URL(actionAttr, url).href;
        }
        debugInfo.formAction = actionUrl;

        // -------------------------------------------------------------
        // ETAPA 4: CÁLCULO E POST DE ACEITE
        // -------------------------------------------------------------
        debugInfo.failedStep = 'HTTP_POST';

        const distanciaNum = parseInt(distanciaBaseOrigem.replace(/\D/g, ''), 10) || 0;
        const valorPrevia = calcularPrevia(distanciaNum);

        const payload: AcceptPayload = {
          Id: id,
          IdAtendimentoConvite: idAtendimentoConvite,
          IdAtendimentoAcionamento: idAtendimentoAcionamento,
          Previa: { Previa: valorPrevia },
          Aceito: true,
          IdAdesao: idAdesao,
          IdCidadeAtendimento: idCidadeAtendimento,
        };

        const responsePost = await this.http.post(actionUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Referer': url,
            'Origin': new URL(url).origin,
          },
        });

        debugInfo.postStatusCode = responsePost.status;
        const durationMs = Date.now() - startTime;

        const isSuccess = responsePost.status >= 200 && responsePost.status < 300;

        return {
          success: isSuccess,
          durationMs,
          statusCode: responsePost.status,
          url,
          distanciaKm: distanciaNum,
          previaValor: valorPrevia,
          payload,
          responsePayload: {
            status: responsePost.status,
            statusText: responsePost.statusText,
            headers: responsePost.headers,
            data: responsePost.data,
          },
          attemptsMade,
          debugInfo,
        };
      } catch (error: any) {
        lastError = error;
        debugInfo.errorStack = error.stack;

        if (error instanceof NonRetryableError || (error.message && error.message.includes('já aceito'))) {
          console.log(`[Scraper] Convite encerrado/não aceitável. Sem retry: ${error.message}`);
          break;
        }

        if (attempt < maxAttempts) {
          console.warn(`[Scraper] Erro temporário na tentativa ${attempt} (${error.message}). Tentando novamente em 300ms...`);
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
      debugInfo,
    };
  }
}
