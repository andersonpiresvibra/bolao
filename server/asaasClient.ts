import crypto from 'node:crypto';
import { getEnv } from './runtimeEnv.ts';

const ALLOWED_ASAAS_HOSTS = new Set([
  'api-sandbox.asaas.com',
  'sandbox.asaas.com',
  'api.asaas.com',
  'www.asaas.com',
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getValidatedAsaasBaseUrl(): string {
  const raw = getEnv('ASAAS_API_URL') || 'https://api-sandbox.asaas.com/v3';
  const normalized = raw.replace(/\/+$/, '');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'https:' || !ALLOWED_ASAAS_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('ASAAS_API_URL inválida. Utilize um domínio oficial HTTPS do Asaas.');
  }
  return normalized;
}

export function getAsaasEnvironment(): 'SANDBOX' | 'PRODUCTION' {
  try {
    const base = getValidatedAsaasBaseUrl();
    return base.toLowerCase().includes('sandbox') ? 'SANDBOX' : 'PRODUCTION';
  } catch {
    return 'SANDBOX';
  }
}

export function isAsaasConfigured(): boolean {
  return getEnv('ASAAS_API_KEY').length > 0;
}

export function verifyAsaasWebhookToken(receivedToken: string | undefined): boolean {
  const expected = getEnv('ASAAS_WEBHOOK_TOKEN');
  if (!expected || !receivedToken) return false;
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  const receivedHash = crypto.createHash('sha256').update(String(receivedToken).trim()).digest();
  return crypto.timingSafeEqual(expectedHash, receivedHash);
}

async function asaasFetch(
  endpointPath: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const apiKey = getEnv('ASAAS_API_KEY');
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY não configurada no servidor.');
  }
  const baseUrl = getValidatedAsaasBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const resp = await fetch(`${baseUrl}${endpointPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'AppBolao/1.0',
        access_token: apiKey,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyAsaasConnection(): Promise<{
  ok: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
  apiUrlValid: boolean;
  authValid: boolean;
  walletIdMatched: boolean;
  webhookTokenConfigured: boolean;
  httpStatus?: number;
  error?: string;
}> {
  const webhookTokenConfigured = Boolean(getEnv('ASAAS_WEBHOOK_TOKEN'));
  const platformWalletId = getEnv('ASAAS_PLATFORM_WALLET_ID');

  let environment: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX';
  try {
    getValidatedAsaasBaseUrl();
    environment = getAsaasEnvironment();
  } catch (err: any) {
    return {
      ok: false,
      environment,
      apiUrlValid: false,
      authValid: false,
      walletIdMatched: false,
      webhookTokenConfigured,
      error: err?.message || 'ASAAS_API_URL inválida.',
    };
  }

  if (!isAsaasConfigured()) {
    return {
      ok: false,
      environment,
      apiUrlValid: true,
      authValid: false,
      walletIdMatched: false,
      webhookTokenConfigured,
      error: 'ASAAS_API_KEY não configurada.',
    };
  }

  try {
    const walletsResp = await asaasFetch('/wallets', { method: 'GET', timeoutMs: 8000 });
    if (!walletsResp.ok) {
      const apiErr =
        walletsResp.data?.errors?.[0]?.description ||
        `HTTP ${walletsResp.status} ao autenticar no Asaas.`;
      return {
        ok: false,
        environment,
        apiUrlValid: true,
        authValid: false,
        walletIdMatched: false,
        webhookTokenConfigured,
        httpStatus: walletsResp.status,
        error: apiErr,
      };
    }

    const wallets: Array<{ id?: string }> = Array.isArray(walletsResp.data?.data)
      ? walletsResp.data.data
      : [];
    const walletIdMatched = Boolean(
      platformWalletId && wallets.some((w) => String(w.id || '').trim() === platformWalletId)
    );

    return {
      ok: true,
      environment,
      apiUrlValid: true,
      authValid: true,
      walletIdMatched,
      webhookTokenConfigured,
      httpStatus: walletsResp.status,
    };
  } catch (err: any) {
    return {
      ok: false,
      environment,
      apiUrlValid: true,
      authValid: false,
      walletIdMatched: false,
      webhookTokenConfigured,
      error: err?.message || 'Falha de rede ao consultar Asaas.',
    };
  }
}

export async function ensureAsaasCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
}): Promise<string | null> {
  const digitsCpf = String(input.cpfCnpj || '').replace(/\D/g, '');
  if (digitsCpf.length !== 11 && digitsCpf.length !== 14) {
    return null;
  }

  const lookup = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(digitsCpf)}`, {
    method: 'GET',
  });
  if (lookup.ok && Array.isArray(lookup.data?.data) && lookup.data.data.length > 0) {
    const existingId = lookup.data.data[0]?.id;
    if (existingId) return String(existingId);
  }

  const digitsPhone = String(input.mobilePhone || '').replace(/\D/g, '');
  const createResp = await asaasFetch('/customers', {
    method: 'POST',
    body: {
      name: String(input.name || 'Participante').trim(),
      cpfCnpj: digitsCpf,
      email: input.email ? String(input.email).trim() : undefined,
      mobilePhone: digitsPhone.length >= 10 ? digitsPhone : undefined,
      notificationDisabled: true,
    },
  });

  if (createResp.ok && createResp.data?.id) {
    return String(createResp.data.id);
  }
  return null;
}

export async function createAsaasPixPayment(input: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  organizerWalletId?: string;
  netPoolAmount: number;
  feePercent: number;
}): Promise<{
  paymentId: string;
  pixQrCodePayload?: string;
  pixEncodedImage?: string;
  expirationDate?: string;
} | null> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const safeDueDate =
    /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) && input.dueDate >= todayIso
      ? input.dueDate
      : todayIso;

  const platformWalletId = getEnv('ASAAS_PLATFORM_WALLET_ID');
  const organizerWallet = String(input.organizerWalletId || '').trim();
  const canSplitToOrganizer =
    UUID_REGEX.test(organizerWallet) &&
    organizerWallet !== platformWalletId &&
    input.netPoolAmount > 0;

  const paymentBody: Record<string, unknown> = {
    customer: input.customerId,
    billingType: 'PIX',
    value: Number(input.value.toFixed(2)),
    dueDate: safeDueDate,
    description: input.description.slice(0, 500),
    externalReference: input.externalReference.slice(0, 100),
  };

  if (canSplitToOrganizer) {
    paymentBody.split = [
      {
        walletId: organizerWallet,
        fixedValue: Number(input.netPoolAmount.toFixed(2)),
        description: `Repasse Bolão (${Number((100 - input.feePercent).toFixed(2))}%)`,
      },
    ];
  }

  const payResp = await asaasFetch('/payments', {
    method: 'POST',
    body: paymentBody,
  });

  if (!payResp.ok || !payResp.data?.id) {
    return null;
  }

  const paymentId = String(payResp.data.id);
  const qrResp = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, {
    method: 'GET',
  });

  return {
    paymentId,
    pixQrCodePayload: qrResp.ok && qrResp.data?.payload ? String(qrResp.data.payload) : undefined,
    pixEncodedImage:
      qrResp.ok && qrResp.data?.encodedImage ? String(qrResp.data.encodedImage) : undefined,
    expirationDate:
      qrResp.ok && qrResp.data?.expirationDate ? String(qrResp.data.expirationDate) : undefined,
  };
}
