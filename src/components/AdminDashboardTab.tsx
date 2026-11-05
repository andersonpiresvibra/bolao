import React, { useState } from 'react';
import {
  Company,
  Pool,
  Participant,
  QuotaPurchase,
  PlatformSettings,
} from '../types';
import { formatCurrencyBRL } from '../utils/lotteryMath';
import {
  Download,
  CheckCircle,
  AlertCircle,
  Sliders,
  RefreshCw,
  ChevronRight,
  Database,
  DollarSign,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface AdminDashboardTabProps {
  companies: Company[];
  pools: Pool[];
  participants: Participant[];
  purchases: QuotaPurchase[];
  settings: PlatformSettings;
  onUpdateSettings: (payload: any) => Promise<void>;
  onConciliatePixNow: (purchaseId: string) => Promise<QuotaPurchase>;
  onSelectCompanyPool: (companyId: string) => void;
  onOpenCoupon: (purchase: QuotaPurchase) => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({
  companies,
  pools,
  purchases,
  settings,
  onUpdateSettings,
  onConciliatePixNow,
  onSelectCompanyPool,
  onOpenCoupon,
}) => {
  const [filterCompanyId, setFilterCompanyId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CONFIRMED' | 'PENDING'>('ALL');
  const [feeInput, setFeeInput] = useState<string>(String(settings.defaultPlatformFeePercent));
  const [walletInput, setWalletInput] = useState<string>(settings.platformAsaasWalletId);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>(settings.supabaseProjectUrl);
  const [savingSettings, setSavingSettings] = useState(false);

  const confirmedPurchases = purchases.filter((p) => p.paymentStatus === 'CONFIRMED');
  const pendingPurchases = purchases.filter((p) => p.paymentStatus === 'PENDING');

  const totalGrossVolume = confirmedPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalPlatformFeeRevenue = confirmedPurchases.reduce(
    (acc, p) => acc + p.platformFeeAmount,
    0
  );
  const totalOrganizerSplits = confirmedPurchases.reduce((acc, p) => acc + p.netPoolAmount, 0);
  const totalPendingVolume = pendingPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalQuotasConfirmed = confirmedPurchases.reduce((acc, p) => acc + p.quotasCount, 0);

  const filteredPurchases = purchases.filter((pur) => {
    const matchesComp = filterCompanyId === 'ALL' || pur.companyId === filterCompanyId;
    const matchesStatus = filterStatus === 'ALL' || pur.paymentStatus === filterStatus;
    return matchesComp && matchesStatus;
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        defaultPlatformFeePercent: Math.max(1, Math.min(50, Number(feeInput) || 10)),
        platformAsaasWalletId: walletInput,
        supabaseProjectUrl: supabaseUrlInput,
        applyFeeToAllPools: true,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCSVReport = () => {
    const headers = [
      'ID Transacao Asaas',
      'Data',
      'Empresa',
      'Colaborador',
      'CPF',
      'WhatsApp',
      'Cotas',
      'Valor Total (R$)',
      'Taxa Plataforma (R$)',
      'Liquido Organizador (R$)',
      'Carteira Destino Split',
      'Status Pagamento',
      'Cupom Digital',
    ];

    const rows = filteredPurchases.map((p) => {
      const comp = companies.find((c) => c.id === p.companyId);
      return [
        p.asaasPaymentId,
        new Date(p.createdAt).toLocaleString('pt-BR'),
        `"${comp?.name || p.companyId}"`,
        `"${p.participantName}"`,
        p.participantCpf,
        `"${p.participantWhatsapp}"`,
        p.quotasCount,
        p.totalAmount.toFixed(2),
        p.platformFeeAmount.toFixed(2),
        p.netPoolAmount.toFixed(2),
        p.organizerWalletId,
        p.paymentStatus,
        p.couponHash,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio-Geral-LotoCorp-Asaas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-4 space-y-5">
      {/* 1. Top Key-Value Summary Card (Exact Image 2 "Resumo" Style) */}
      <div className="caixa-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#EDF2F7] pb-2.5">
          <div>
            <h1 className="font-display font-bold text-sm text-[#333E48]">
              Resumo Financeiro Global (Split Pix)
            </h1>
            <p className="text-xs text-[#5F6C7B] mt-0.5">
              Consolidação automática de todas as empresas cadastradas
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCSVReport}
            className="text-xs font-bold text-[#005CA9] flex items-center gap-1 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Volume bruto conciliado ({totalQuotasConfirmed} cotas)</span>
            <span className="font-mono-tabular font-bold text-[#333E48]">
              {formatCurrencyBRL(totalGrossVolume)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">Repassado aos organizadores</span>
            <span className="font-mono-tabular font-bold text-[#008B47]">
              {formatCurrencyBRL(totalOrganizerSplits)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">
              Receita taxa plataforma ({settings.defaultPlatformFeePercent}%)
            </span>
            <span className="font-mono-tabular font-bold text-[#005CA9]">
              {formatCurrencyBRL(totalPlatformFeeRevenue)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5F6C7B]">
              Pagamentos pendentes ({pendingPurchases.length})
            </span>
            <span className="font-mono-tabular font-bold text-amber-700">
              {formatCurrencyBRL(totalPendingVolume)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 2x2 Quick Filter & Action Cards (Exact Image 1 Grid Style) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Indicadores e relatórios
          </h2>
          <button
            type="button"
            onClick={handleExportCSVReport}
            className="text-xs font-bold text-[#005CA9] flex items-center gap-0.5"
          >
            <span>Baixar planilha</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFilterStatus('CONFIRMED')}
            className="caixa-tile p-3.5 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <DollarSign className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9]">
              {formatCurrencyBRL(totalGrossVolume)}
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                Cotas conciliadas
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('CONFIRMED')}
            className="caixa-tile p-3.5 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <TrendingUp className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9]">
              {formatCurrencyBRL(totalPlatformFeeRevenue)}
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                Taxa retida ({settings.defaultPlatformFeePercent}%)
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className="caixa-tile p-3.5 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <Clock className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9]">
              {pendingPurchases.length} pendentes
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                {formatCurrencyBRL(totalPendingVolume)}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleExportCSVReport}
            className="caixa-tile p-3.5 flex flex-col items-center justify-center text-center gap-2"
          >
            <div className="caixa-icon-halo">
              <Download className="w-5 h-5 text-[#005CA9]" />
            </div>
            <div className="font-display font-bold text-xs text-[#005CA9]">
              Exportar relatório
              <span className="block font-normal text-[11px] text-[#5F6C7B] mt-0.5">
                Auditoria completa
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 3. Per-Company Consolidated Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Grupos corporativos ({companies.length})
          </h2>
          <span className="text-xs font-bold text-[#005CA9]">Multitenant</span>
        </div>

        <div className="space-y-3">
          {companies.map((comp) => {
            const pool = pools.find((p) => p.companyId === comp.id);
            const compPurchases = purchases.filter((p) => p.companyId === comp.id);
            const compConfirmed = compPurchases.filter((p) => p.paymentStatus === 'CONFIRMED');
            const compPending = compPurchases.filter((p) => p.paymentStatus === 'PENDING');

            const gross = compConfirmed.reduce((acc, p) => acc + p.totalAmount, 0);
            const netOrg = compConfirmed.reduce((acc, p) => acc + p.netPoolAmount, 0);
            const feePlat = compConfirmed.reduce((acc, p) => acc + p.platformFeeAmount, 0);
            const quotasSold = compConfirmed.reduce((acc, p) => acc + p.quotasCount, 0);

            return (
              <div
                key={comp.id}
                onClick={() => onSelectCompanyPool(comp.id)}
                className="caixa-card p-4 space-y-2.5 text-xs cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-sm text-[#333E48]">
                      {comp.name}
                    </div>
                    <div className="text-xs text-[#5F6C7B] mt-0.5">
                      Gestor: {comp.managerName} · Pix: {comp.managerPixKey || comp.asaasWalletId}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#005CA9] flex items-center gap-0.5 shrink-0">
                    <span>Abrir</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>

                <div className="pt-2 border-t border-[#EDF2F7] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#5F6C7B]">
                      Cotas vendidas ({quotasSold}/{pool?.maxQuotas || '-'})
                    </span>
                    <span className="font-mono-tabular font-bold text-[#333E48]">
                      {formatCurrencyBRL(gross)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6C7B]">Repasse organizador</span>
                    <span className="font-mono-tabular font-bold text-[#008B47]">
                      {formatCurrencyBRL(netOrg)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6C7B]">Taxa plataforma</span>
                    <span className="font-mono-tabular font-bold text-[#005CA9]">
                      {formatCurrencyBRL(feePlat)}
                    </span>
                  </div>
                  {compPending.length > 0 && (
                    <div className="flex justify-between text-amber-800 pt-1">
                      <span>Pagamentos pendentes ({compPending.length})</span>
                      <span className="font-mono-tabular font-bold">
                        {formatCurrencyBRL(compPending.reduce((a, b) => a + b.totalAmount, 0))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Real-Time Transactions & Pending Payments Control */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Transações e pendências
          </h2>
          {filterStatus !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className="text-xs font-bold text-[#005CA9]"
            >
              Mostrar todas &gt;
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <select
            value={filterCompanyId}
            onChange={(e) => setFilterCompanyId(e.target.value)}
            className="caixa-input"
          >
            <option value="ALL">Todas as empresas ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="caixa-input"
          >
            <option value="ALL">Todos os status ({purchases.length})</option>
            <option value="CONFIRMED">Conciliados ({confirmedPurchases.length})</option>
            <option value="PENDING">Pendentes Pix ({pendingPurchases.length})</option>
          </select>
        </div>

        <div className="caixa-card divide-y divide-[#EDF2F7] px-4">
          {filteredPurchases.map((pur) => {
            const comp = companies.find((c) => c.id === pur.companyId);
            return (
              <div key={pur.id} className="py-3.5 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#333E48]">
                      {pur.participantName}{' '}
                      <span className="font-normal text-[#5F6C7B]">({pur.participantCpf})</span>
                    </div>
                    <div className="text-[11px] text-[#5F6C7B] mt-0.5">
                      {comp?.name} · {pur.participantWhatsapp}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-tabular font-bold text-[#333E48]">
                      {pur.quotasCount} cota(s) · {formatCurrencyBRL(pur.totalAmount)}
                    </div>
                    <div className="text-[10px] font-mono-tabular text-[#5F6C7B]">
                      Org: {formatCurrencyBRL(pur.netPoolAmount)} | Taxa:{' '}
                      {formatCurrencyBRL(pur.platformFeeAmount)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono-tabular text-[10px] text-[#5F6C7B]">
                    {pur.asaasPaymentId}
                  </span>

                  {pur.paymentStatus === 'CONFIRMED' ? (
                    <button
                      type="button"
                      onClick={() => onOpenCoupon(pur)}
                      className="text-xs font-bold text-[#005CA9] flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-[#008B47]" />
                      <span>Ver cupom</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onConciliatePixNow(pur.id)}
                      className="text-xs font-bold text-amber-700 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Conciliar agora</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Asaas Split Fee & Database Integration Settings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-[#333E48]">
            Parâmetros de Split e banco
          </h2>
          <Sliders className="w-4 h-4 text-[#005CA9]" />
        </div>

        <form onSubmit={handleSaveSettings} className="caixa-card p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">
                Taxa plataforma (%)
              </label>
              <input
                type="number"
                min={1}
                max={40}
                step={0.5}
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                className="caixa-input font-mono-tabular font-bold text-[#005CA9]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#333E48] mb-1">
                Repasse líquido bolão (%)
              </label>
              <input
                type="text"
                readOnly
                value={`${(100 - (Number(feeInput) || 0)).toFixed(1)}%`}
                className="caixa-input bg-[#F1F5F9] font-mono-tabular font-bold text-[#008B47]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#333E48] mb-1">
              Carteira principal plataforma (Asaas Master Wallet)
            </label>
            <input
              type="text"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              className="caixa-input font-mono-tabular text-[11px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#333E48] mb-1 flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-[#005CA9]" />
              <span>Endpoint Supabase / PostgreSQL</span>
            </label>
            <input
              type="text"
              value={supabaseUrlInput}
              onChange={(e) => setSupabaseUrlInput(e.target.value)}
              className="caixa-input font-mono-tabular text-[11px]"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="w-full min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs rounded-[4px] flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {savingSettings
                ? 'Atualizando Split...'
                : 'Salvar Taxa Administrativa no Split Asaas'}
            </span>
          </button>
        </form>
      </section>
    </div>
  );
};
