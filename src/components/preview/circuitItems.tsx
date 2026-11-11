import type { ComponentType } from "react";
import type { CircuitTemplate, ComponentKind, CurrentSense } from "@geosimples/core/figure";
import { CapacitorIcon, CircuitIcon, LampIcon, MeterIcon, ResistorIcon, SourceIcon, SwitchIcon } from "@/components/icons";

/** The pieces a circuit is built from, as Inserir and the Circuito menu list them. */
export const COMPONENT_ITEMS: { kind: ComponentKind; title: string; hint: string; Icon: ComponentType }[] = [
  { kind: "resistor", title: "Resistor", hint: "10 Ω, mudado em Propriedades.", Icon: ResistorIcon },
  { kind: "lamp", title: "Lâmpada", hint: "Um resistor com o seu próprio símbolo.", Icon: LampIcon },
  { kind: "source", title: "Gerador", hint: "O polo positivo, a placa longa, fica no segundo ponto.", Icon: SourceIcon },
  { kind: "switch", title: "Chave", hint: "Aberta ou fechada em Propriedades.", Icon: SwitchIcon },
  { kind: "ammeter", title: "Amperímetro", hint: "Ideal: em série, mede a corrente.", Icon: () => <MeterIcon letter="A" /> },
  { kind: "voltmeter", title: "Voltímetro", hint: "Ideal: em paralelo, mede a tensão.", Icon: () => <MeterIcon letter="V" /> },
  { kind: "capacitor", title: "Capacitor", hint: "Carregado, não deixa passar corrente.", Icon: CapacitorIcon },
];

export const TEMPLATE_ITEMS: { template: CircuitTemplate; title: string; hint: string; Icon: ComponentType }[] = [
  { template: "series", title: "Circuito em série", hint: "Gerador e dois resistores.", Icon: CircuitIcon },
  { template: "parallel", title: "Circuito em paralelo", hint: "Dois resistores ligados ao gerador.", Icon: CircuitIcon },
  { template: "mixed", title: "Circuito misto", hint: "Um resistor em série com dois em paralelo.", Icon: CircuitIcon },
  { template: "twoLoops", title: "Duas malhas", hint: "Um gerador em cada malha.", Icon: CircuitIcon },
];

export const CURRENT_OPTIONS: { value: CurrentSense; label: string; title: string }[] = [
  { value: "none", label: "Não indicar", title: "Sem setas de corrente" },
  { value: "conventional", label: "Convencional", title: "Do polo positivo ao negativo" },
  { value: "real", label: "Real", title: "O sentido dos elétrons, do negativo ao positivo" },
];
