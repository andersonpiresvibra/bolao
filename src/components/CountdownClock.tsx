import React, { useEffect, useState } from 'react';

interface CountdownClockProps {
  startDate: string;
  endDate: string;
  compact?: boolean;
}

interface TimeRemaining {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calculateRemaining(endDateStr: string): TimeRemaining {
  const now = new Date();
  const target = new Date(endDateStr);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0 || isNaN(diffMs)) {
    return { months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  return { months, days, hours, minutes, seconds, expired: false };
}

export const CountdownClock: React.FC<CountdownClockProps> = ({
  startDate,
  endDate,
  compact = false,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() => calculateRemaining(endDate));

  useEffect(() => {
    setTimeLeft(calculateRemaining(endDate));
    const interval = setInterval(() => {
      setTimeLeft(calculateRemaining(endDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (compact) {
    if (timeLeft.expired) {
      return (
        <div className="text-[11px] font-medium text-[#5F6C7B] inline-flex items-center gap-1">
          <span>Apostas encerradas</span>
        </div>
      );
    }

    const totalDays = timeLeft.months * 30 + timeLeft.days;
    let naturalText = '';
    if (totalDays > 0) {
      const dayLabel = totalDays === 1 ? 'dia' : 'dias';
      const hourLabel = timeLeft.hours === 1 ? 'hora' : 'horas';
      naturalText =
        timeLeft.hours > 0
          ? `${totalDays} ${dayLabel} e ${timeLeft.hours} ${hourLabel}`
          : `${totalDays} ${dayLabel}`;
    } else if (timeLeft.hours > 0) {
      const hourLabel = timeLeft.hours === 1 ? 'hora' : 'horas';
      naturalText =
        timeLeft.minutes > 0
          ? `${timeLeft.hours} ${hourLabel} e ${timeLeft.minutes} min`
          : `${timeLeft.hours} ${hourLabel}`;
    } else {
      naturalText = `${ Math.max(1, timeLeft.minutes) } minutos`;
    }

    return (
      <div className="text-[11px] text-[#5F6C7B] inline-flex items-center gap-1">
        <span>Encerra em</span>
        <strong className="font-semibold text-[#005CA9]">{naturalText}</strong>
      </div>
    );
  }

  const startFormatted = new Date(startDate).toLocaleDateString('pt-BR');
  const endFormatted = new Date(endDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="caixa-card p-4">
      <div className="flex items-center justify-between text-xs text-[#5F6C7B] mb-3">
        <span>Início: {startFormatted}</span>
        <span>
          Encerramento: <strong className="text-[#333E48]">{endFormatted}</strong>
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center">
        <div className="bg-[#F7F9FC] py-2 px-1 rounded-[4px]">
          <div className="font-mono-tabular text-base font-bold text-[#005CA9] leading-none">
            {pad(timeLeft.months)}
          </div>
          <div className="text-[9px] font-semibold text-[#5F6C7B] mt-1">MESES</div>
        </div>
        <div className="bg-[#F7F9FC] py-2 px-1 rounded-[4px]">
          <div className="font-mono-tabular text-base font-bold text-[#005CA9] leading-none">
            {pad(timeLeft.days)}
          </div>
          <div className="text-[9px] font-semibold text-[#5F6C7B] mt-1">DIAS</div>
        </div>
        <div className="bg-[#F7F9FC] py-2 px-1 rounded-[4px]">
          <div className="font-mono-tabular text-base font-bold text-[#005CA9] leading-none">
            {pad(timeLeft.hours)}
          </div>
          <div className="text-[9px] font-semibold text-[#5F6C7B] mt-1">HORAS</div>
        </div>
        <div className="bg-[#F7F9FC] py-2 px-1 rounded-[4px]">
          <div className="font-mono-tabular text-base font-bold text-[#005CA9] leading-none">
            {pad(timeLeft.minutes)}
          </div>
          <div className="text-[9px] font-semibold text-[#5F6C7B] mt-1">MIN</div>
        </div>
        <div className="bg-[#EBF4FC] py-2 px-1 rounded-[4px]">
          <div className="font-mono-tabular text-base font-bold text-[#005CA9] leading-none">
            {pad(timeLeft.seconds)}
          </div>
          <div className="text-[9px] font-bold text-[#005CA9] mt-1">SEG</div>
        </div>
      </div>
    </div>
  );
};
