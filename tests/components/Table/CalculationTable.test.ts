import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { CalculationTable } from '../../../src/components/Table/CalculationTable';
import { DateOnly } from '../../../src/domain/value-objects/DateOnly';
import { Lot } from '../../../src/domain/value-objects/Lot';
import { Protocol } from '../../../src/domain/value-objects/Protocol';
import { lotsSignal, setLots } from '../../../src/state/signals/lots';

function createLot(id: string, name: string, day: number): Lot {
  const protocol = Protocol.create('p1', 'D0-D7-D9', [0, 7, 9], 'D0-D7-D9');
  return Lot.create(id, name, DateOnly.create(2026, 1, day), protocol, [22, 22, 22]);
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function doubleClick(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
}

function typeInput(input: HTMLInputElement, value: string): void {
  act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('CalculationTable', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    setLots([]);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    setLots([]);
  });

  it('renders empty state when there are no lots', () => {
    act(() => {
      render(h(CalculationTable, {}), container);
    });

    expect(container.textContent).toContain('Nenhum lote adicionado');
  });

  it('updates D0 and gap values through quick controls', () => {
    setLots([createLot('lot-1', 'Lote A', 5)]);

    act(() => {
      render(h(CalculationTable, {}), container);
    });

    const d0PlusButton = container.querySelector('[title="Avançar 1 dia"]') as HTMLButtonElement;
    click(d0PlusButton);

    expect(lotsSignal.value[0]!.d0.equals(DateOnly.create(2026, 1, 6))).toBe(true);

    const gapPlusButton = container.querySelector('[title="Mais 1 dia"]') as HTMLButtonElement;
    click(gapPlusButton);

    expect(lotsSignal.value[0]!.roundGaps[0]).toBe(23);
  });

  it('edits lot data and removes lot via confirmation modal', () => {
    const lot = createLot('lot-1', 'Lote Original', 5);
    setLots([lot]);

    act(() => {
      render(h(CalculationTable, {}), container);
    });

    const lotNameElement = container.querySelector('.lot-name-text') as HTMLSpanElement;
    doubleClick(lotNameElement);

    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const protocolSelect = container.querySelector('select') as HTMLSelectElement;

    typeInput(nameInput, 'Lote Editado');
    typeInput(dateInput, '2026-01-20');
    changeSelect(protocolSelect, 'protocol-2');

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Salvar')
    ) as HTMLButtonElement;
    click(saveButton);

    expect(lotsSignal.value[0]!.name).toBe('Lote Editado');
    expect(lotsSignal.value[0]!.d0.equals(DateOnly.create(2026, 1, 20))).toBe(true);
    expect(lotsSignal.value[0]!.protocol.id).toBe('protocol-2');

    const updatedLotNameElement = container.querySelector('.lot-name-text') as HTMLSpanElement;
    doubleClick(updatedLotNameElement);

    const removeLotButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Remover lote')
    ) as HTMLButtonElement;
    click(removeLotButton);

    const confirmRemoveButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent === 'Remover'
    ) as HTMLButtonElement;
    click(confirmRemoveButton);

    expect(lotsSignal.value).toEqual([]);
  });
});
