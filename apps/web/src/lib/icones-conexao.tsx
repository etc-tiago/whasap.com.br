import type { IconeConexao } from "@whasap/config";
import {
  Bot,
  Briefcase,
  Building2,
  GraduationCap,
  Headphones,
  Headset,
  HeartHandshake,
  Home,
  type LucideIcon,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

export const ICONES_CONEXAO_MAP: Record<IconeConexao, LucideIcon> = {
  MessageCircle,
  MessagesSquare,
  Phone,
  Headphones,
  Headset,
  Building2,
  Store,
  Briefcase,
  Users,
  UserRound,
  HeartHandshake,
  ShoppingCart,
  Truck,
  Wrench,
  Stethoscope,
  GraduationCap,
  Home,
  MapPin,
  Bot,
  Sparkles,
};

export function IconeConexaoLucide({
  nome,
  className,
}: {
  nome: string;
  className?: string;
}) {
  const Icone = ICONES_CONEXAO_MAP[nome as IconeConexao] ?? MessageCircle;
  return <Icone className={className} />;
}
