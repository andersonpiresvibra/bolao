import React from 'react';
import { Company, Pool, LotteryGame, QuotaPurchase } from '../types';
import { formatCurrencyBRL } from '../utils/lotteryMath';
import { Download, Share2, CheckSquare, Shield, X, Copy, Check } from 'lucide-react';

interface DigitalCouponModalProps {
  purchase: QuotaPurchase;
  company: Company;
  pool: Pool;
  games: LotteryGame[];
  onClose: () => void;
}

export const DigitalCouponModal: React.FC<DigitalCouponModalProps> = ({
  purchase,
  company,
  pool,
  games,
  onClose,
}) => {
  const [copiedHash, setCopiedHash] = React.useState(false);

  const handleDownloadReceipt = () => {
    const receiptText = [
      '====================================================',
      '   COMPROVANTE OFICIAL DE COTA — BOLÃO CORPORATIVO  ',
      '               BV-MEGA DA VIRADA & ASAAS            ',
      '====================================================',
      `CÓDIGO CUPOM DIGITAL: ${purchase.couponHash}`,
      `STATUS DO PAGAMENTO : ${purchase.paymentStatus === 'CONFIRMED' ? 'CONFIRMADO (CONCILIADO PIX)' : 'AGUARDANDO PIX'}`,
      `DATA DA TRANSAÇÃO   : ${new Date(purchase.paidAt || purchase.createdAt).toLocaleString('pt-BR')}`,
      '----------------------------------------------------',
      `GRUPO DE BOLÃO      : ${company.name}`,
      `CNPJ                : ${company.cnpj}`,
      `ORGANIZADOR DO GRUPO: ${company.managerName}`,
      `CARTEIRA SPLIT ASAAS: ${company.asaasWalletId}`,
      '----------------------------------------------------',
      `BOLÃO               : ${pool.title}`,
      `MODALIDADE          : ${pool.lotteryType} (Concurso ${pool.contestNumber})`,
      `RECIBO DO BOLÃO     : ${pool.officialReceiptCode}`,
      '----------------------------------------------------',
      `PARTICIPANTE        : ${purchase.participantName}`,
      `CPF                 : ${purchase.participantCpf}`,
      `WHATSAPP            : ${purchase.participantWhatsapp}`,
      `QUANTIDADE DE COTAS : ${purchase.quotasCount} cota(s)`,
      `VALOR UNITÁRIO COTA : ${formatCurrencyBRL(purchase.unitQuotaValue)}`,
      `VALOR TOTAL PAGO    : ${formatCurrencyBRL(purchase.totalAmount)}`,
      '----------------------------------------------------',
      'AUDITORIA DE SPLIT AUTOMÁTICO (ASAAS PIX):',
      `- Repasse Líquido Bolão (${100 - purchase.platformFeePercent}%): ${formatCurrencyBRL(purchase.netPoolAmount)}`,
      `- Taxa Administrativa Plataforma (${purchase.platformFeePercent}%): ${formatCurrencyBRL(purchase.platformFeeAmount)}`,
      `- ID Transação Asaas: ${purchase.asaasPaymentId}`,
      '----------------------------------------------------',
      `VOLANTES / JOGOS VINCULADOS (${games.length}):`,
      ...games.map(
        (g, idx) =>
          `  Jogo #${idx + 1} (${g.dozensCount} dez): [${g.numbers
            .map((n) => String(n).padStart(2, '0'))
            .join(' - ')}] (${g.lotericaReceiptCode})`
      ),
      '====================================================',
      'Documento auditável digitalmente na plataforma.',
    ].join('\n');

    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Cupom-Bolao-${purchase.couponHash}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*COMPROVANTE DE COTA — BOLÃO CORPORATIVO*\n` +
        `Grupo de Bolão: *${company.name}*\n` +
        `Bolão: *${pool.title}*\n` +
        `Participante: ${purchase.participantName}\n` +
        `Cotas adquiridas: *${purchase.quotasCount} cota(s)* (${formatCurrencyBRL(purchase.totalAmount)})\n` +
        `Status Pix Asaas: *${purchase.paymentStatus === 'CONFIRMED' ? 'PAGO E CONCILIADO' : 'PENDENTE'}*\n` +
        `Cupom Digital: *${purchase.couponHash}*`
    );
    const waLink = `https://wa.me/?text=${text}`;
    navigator.clipboard?.writeText(decodeURIComponent(text));
    const a = document.createElement('a');
    a.href = waLink;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleCopyHash = () => {
    navigator.clipboard?.writeText(purchase.couponHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1E293B]/55 backdrop-blur-[1px] flex items-center justify-center p-3 overflow-y-auto">
      <div className="w-full max-w-[406px] caixa-card overflow-hidden my-auto">
        {/* Top Receipt Header */}
        <div className="caixa-header-gradient text-white px-4 py-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/85">
              Comprovante Oficial de Participação
            </div>
            <h3 className="font-display font-bold text-sm">Cupom Digital de Cota</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white/15 hover:bg-white/25 text-white flex items-center justify-center rounded-[4px]"
            aria-label="Fechar cupom"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Banner */}
        <div
          className={`px-4 py-2 border-b border-[#EDF2F7] flex items-center justify-between text-xs font-semibold ${
            purchase.paymentStatus === 'CONFIRMED'
              ? 'bg-emerald-50 text-[#008B47]'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4" />
            <span>
              {purchase.paymentStatus === 'CONFIRMED'
                ? 'Pagamento Pix conciliado'
                : 'Aguardando compensação Pix'}
            </span>
          </div>
          <span className="font-mono-tabular text-[11px]">{purchase.asaasPaymentId}</span>
        </div>

        {/* Receipt Body (Clean Key-Value Rows without Nested Boxes) */}
        <div className="p-4 space-y-3.5 text-xs bg-white">
          {/* Coupon Hash Row */}
          <div className="bg-[#F7F9FC] px-3 py-2.5 rounded-[4px] flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#5F6C7B] font-semibold">
                Código do cupom digital
              </div>
              <div className="font-mono-tabular font-bold text-sm text-[#005CA9]">
                {purchase.couponHash}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyHash}
              className="px-2.5 py-1.5 bg-[#EBF4FC] text-[#005CA9] text-[11px] font-bold flex items-center gap-1 rounded-[4px]"
            >
              {copiedHash ? (
                <Check className="w-3.5 h-3.5 text-[#008B47]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedHash ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>

          {/* Company & Pool Key-Value Lines */}
          <div className="border-t border-b border-[#EDF2F7] py-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Grupo de Bolão</span>
              <span className="font-bold text-[#333E48] text-right">{company.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Responsável pelo grupo</span>
              <span className="font-medium text-[#333E48]">{company.managerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Bolão / Concurso</span>
              <span className="font-bold text-[#005CA9] text-right">
                {pool.lotteryType} #{pool.contestNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Recibo de custódia</span>
              <span className="font-mono-tabular text-[#333E48]">
                {pool.officialReceiptCode}
              </span>
            </div>
          </div>

          {/* Collaborator & Financial Split Details */}
          <div className="space-y-2 border-b border-[#EDF2F7] pb-3">
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Participante titular</span>
              <span className="font-bold text-[#333E48]">{purchase.participantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">CPF / WhatsApp</span>
              <span className="font-mono-tabular text-[#333E48]">
                {purchase.participantCpf} · {purchase.participantWhatsapp}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6C7B]">Quantidade de cotas</span>
              <span className="font-mono-tabular font-bold text-[#333E48]">
                {purchase.quotasCount} cota(s) x {formatCurrencyBRL(purchase.unitQuotaValue)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1 font-bold text-[#333E48]">
              <span>Valor total pago</span>
              <span className="font-mono-tabular text-[#008B47]">
                {formatCurrencyBRL(purchase.totalAmount)}
              </span>
            </div>
          </div>

          {/* Asaas Split Transparency Breakdown */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#005CA9]">
              <Shield className="w-3.5 h-3.5" />
              <span>Transparência Split Asaas (Liquidação Automática)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#5F6C7B]">
                Repasse direto ao bolão ({100 - purchase.platformFeePercent}%)
              </span>
              <span className="font-mono-tabular font-bold text-[#008B47]">
                {formatCurrencyBRL(purchase.netPoolAmount)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#5F6C7B]">
                Taxa administrativa plataforma ({purchase.platformFeePercent}%)
              </span>
              <span className="font-mono-tabular font-semibold text-[#333E48]">
                {formatCurrencyBRL(purchase.platformFeeAmount)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="min-h-[42px] bg-[#F7F9FC] hover:bg-[#EDF2F7] border border-[#D5E0EC] text-[#333E48] font-bold text-xs px-3 py-2 rounded-[4px] flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4 text-[#005CA9] shrink-0" />
              <span>Baixar Cupom</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="min-h-[42px] bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs px-3 py-2 rounded-[4px] flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Compartilhar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
