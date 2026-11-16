import {
  Banknote,
  Boxes,
  Briefcase,
  Calculator,
  Car,
  Fuel,
  GraduationCap,
  Landmark,
  Laptop,
  type LucideIcon,
  Megaphone,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Undo2,
  Utensils,
  Wallet,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Fatture: Receipt,
  Vendite: ShoppingBag,
  Rimborsi: Undo2,
  "Software e abbonamenti": Laptop,
  "Materiali e prodotti di consumo": Boxes,
  "Merci per la rivendita": ShoppingCart,
  Hardware: Package,
  "Auto e carburante": Fuel,
  "Vitto e alloggio": Utensils,
  Formazione: GraduationCap,
  Marketing: Megaphone,
  Trasporti: Car,
  "Telefono e internet": Smartphone,
  Commercialista: Calculator,
  "Tasse e contributi": Landmark,
  Banca: Banknote,
};

/** Icona della categoria; per le categorie sconosciute un'icona generica per tipo. */
export function categoryIcon(category: string, kind: "entrata" | "uscita"): LucideIcon {
  return ICONS[category] ?? (kind === "entrata" ? Wallet : Briefcase);
}
