import type { Slot, SlotStatus } from '../lib/types';

type SlotGridProps = { slots: Slot[]; onSelect: (startHour: number) => void; disabled?: boolean };

const statusText: Record<SlotStatus, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  unavailable: 'No disponible',
};

const statusClass: Record<SlotStatus, string> = {
  available: 'border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  reserved: 'border-rose-200 bg-rose-50 text-rose-700',
  unavailable: 'border-slate-200 bg-slate-100 text-slate-400',
};

export const SlotGrid = ({ slots, onSelect, disabled = false }: SlotGridProps) => (
  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
    {slots.map((slot) => (
      <li key={slot.startHour} data-testid="slot">
        <button
          type="button"
          disabled={disabled || slot.status !== 'available'}
          onClick={() => onSelect(slot.startHour)}
          className={`flex w-full flex-col items-center rounded-md border px-2 py-2 text-sm disabled:cursor-not-allowed ${statusClass[slot.status]}`}
        >
          <span className="font-semibold tabular-nums">{slot.label}</span>
          <span className="text-xs">{statusText[slot.status]}</span>
        </button>
      </li>
    ))}
  </ul>
);
