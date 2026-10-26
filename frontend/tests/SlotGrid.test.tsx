import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlotGrid } from '../src/components/SlotGrid';
import type { Slot, SlotStatus } from '../src/lib/types';

const pad = (n: number) => String(n).padStart(2, '0');
const statusFor = (h: number): SlotStatus => (h <= 10 ? 'unavailable' : h === 18 ? 'reserved' : 'available');
const slots: Slot[] = Array.from({ length: 24 }, (_, h) => ({
  startHour: h,
  label: `${pad(h)}:00–${pad(h + 1)}:00`,
  status: statusFor(h),
}));

describe('SlotGrid', () => {
  it('muestra 24 celdas con su etiqueta y el estado en texto', () => {
    render(<SlotGrid slots={slots} onSelect={() => {}} />);
    expect(screen.getAllByTestId('slot')).toHaveLength(24);
    for (const s of slots) expect(screen.getByText(s.label)).toBeInTheDocument();
    expect(screen.getAllByText('No disponible')).toHaveLength(11);
    expect(screen.getAllByText('Reservado')).toHaveLength(1);
    expect(screen.getAllByText('Disponible')).toHaveLength(12);
  });

  it('solo los bloques disponibles son botones habilitados y llaman onSelect', () => {
    const onSelect = vi.fn();
    render(<SlotGrid slots={slots} onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(24);
    expect(buttons.filter((b) => !(b as HTMLButtonElement).disabled)).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: /18:00–19:00/ }));
    fireEvent.click(screen.getByRole('button', { name: /09:00–10:00/ }));
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /20:00–21:00/ }));
    expect(onSelect).toHaveBeenCalledWith(20);
  });

  it('disabled deshabilita todos los bloques', () => {
    render(<SlotGrid slots={slots} onSelect={() => {}} disabled />);
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
  });
});
